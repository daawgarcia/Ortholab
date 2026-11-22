# encoding: utf-8
# Login único (Portal do Credenciado / Ortholab 2 / Rewards -> Ortholab 1).
# Recebe ?t=v1.<payload>.<assinatura> assinado com HMAC-SHA256 (segredo SSO_SECRET),
# válido por 90 s e de uso único. Acha o dentista por e-mail, CPF ou CRO + primeiro nome
# (nunca só pelo nome) e abre a sessão do Devise. Não grava nada no banco.
require 'openssl'
require 'base64'
require 'json'

class SsoController < ApplicationController
  skip_before_action :authenticate_user!
  skip_before_action :require_data_consent!
  skip_before_action :verify_authenticity_token

  DESTINO = 'ortholab1'.freeze

  def entrar
    dados = verificar(params[:t].to_s)
    return falhar(:expirado) unless dados

    user = achar_usuario(dados)
    return falhar(:nao_encontrado) unless user
    return falhar(:nao_liberado) unless user.active_for_authentication?

    sign_out(:user) if user_signed_in? && current_user.id != user.id
    sign_in(:user, user)
    Rails.logger.info("[SSO] login unico user=#{user.id} origem=#{dados['o']}")
    redirect_to root_path
  rescue => e
    Rails.logger.error("[SSO] erro #{e.class}: #{e.message}")
    falhar(:expirado)
  end

  private

  def segredo
    ENV['SSO_SECRET'].to_s
  end

  def b64url_dec(s)
    s = s.tr('-_', '+/')
    s += '=' * ((4 - s.length % 4) % 4)
    Base64.decode64(s)
  end

  def b64url_enc(bin)
    Base64.strict_encode64(bin).tr('+/', '-_').delete('=')
  end

  def iguais?(a, b)
    return false unless a.bytesize == b.bytesize
    r = 0
    a.bytes.zip(b.bytes) { |x, y| r |= x ^ y }
    r.zero?
  end

  def verificar(token)
    return nil if segredo.empty?
    partes = token.split('.')
    return nil unless partes.length == 3 && partes[0] == 'v1'
    esperado = b64url_enc(OpenSSL::HMAC.digest('sha256', segredo, "v1.#{partes[1]}"))
    return nil unless iguais?(esperado, partes[2])
    dados = JSON.parse(b64url_dec(partes[1]))
    agora = Time.now.to_i
    return nil unless dados['d'] == DESTINO
    return nil if dados['exp'].to_i < agora || dados['iat'].to_i > agora + 30
    chave = "sso_nonce:#{dados['n']}"
    return nil if dados['n'].to_s.empty? || Rails.cache.exist?(chave)
    Rails.cache.write(chave, 1, expires_in: 5.minutes)
    dados
  rescue
    nil
  end

  def digitos(v)
    v.to_s.gsub(/\D/, '')
  end

  # só usuários ligados a um dentista (equipe e admin não entram por aqui)
  def de_dentista(users)
    users.detect { |u| u.respond_to?(:dentist) && u.dentist.present? }
  end

  def usuarios_dos_dentistas(ids)
    return [] if ids.blank?
    uids = UserDentist.where(dentist_id: ids).pluck(:user_id)
    User.where(id: uids).to_a
  end

  SQL_DIGITOS = "REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(%s,'.',''),'-',''),'/',''),' ',''),',','')".freeze

  def achar_usuario(d)
    email = d['e'].to_s.strip.downcase
    if email.include?('@')
      u = de_dentista(User.where('LOWER(email) = ?', email).to_a)
      return u if u
    end

    cpf = digitos(d['cpf'])
    if cpf.length == 11
      ids = Dentist.where("#{format(SQL_DIGITOS, 'cpf')} = ?", cpf).pluck(:id)
      ids |= ActiveRecord::Base.connection.select_values(
        ActiveRecord::Base.send(:sanitize_sql_array,
          ["SELECT dentist_id FROM protheus_clientes WHERE IFNULL(excluido,0)=0 AND #{format(SQL_DIGITOS, 'dcto')} = ?", cpf])
      ).map(&:to_i)
      u = de_dentista(usuarios_dos_dentistas(ids))
      return u if u
    end

    cro = digitos(d['cro'])
    primeiro = d['nm'].to_s.strip.split(/\s+/).first.to_s.downcase
    if cro.length >= 3 && primeiro.length >= 2
      ids = Dentist.where("#{format(SQL_DIGITOS, 'cro')} = ?", cro).to_a
                   .select { |x| x.name.to_s.strip.downcase.start_with?(primeiro) }.map(&:id)
      u = de_dentista(usuarios_dos_dentistas(ids))
      return u if u
    end
    nil
  end

  def falhar(motivo)
    msg = {
      expirado: 'O link de acesso expirou. Entre com seu e-mail e senha.',
      nao_encontrado: 'Não encontramos seu cadastro no Ortholab com os dados do portal. Entre com seu e-mail e senha.',
      nao_liberado: 'Seu acesso ao Ortholab ainda não está liberado. Fale com o suporte.'
    }[motivo]
    flash[:alert] = msg
    redirect_to new_user_session_path
  end
end
