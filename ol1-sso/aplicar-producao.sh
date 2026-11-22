#!/bin/bash
# Login único no Ortholab 1 (produção). Rodar no servidor ec2-ortholab como ubuntu:
#   bash aplicar-producao.sh <CHAVE_SSO>
# Faz backup, coloca 1 arquivo novo + 1 linha na rotas, grava a chave e reinicia o Ortholab (~30-60 s fora do ar).
set -e
CHAVE="$1"; [ ${#CHAVE} -ge 32 ] || { echo "Informe a chave SSO"; exit 1; }
APP=/home/ubuntu/webapps/easysmile-web
COMMIT=__COMMIT__
BK=/home/ubuntu/backup-sso-$(date +%Y%m%d-%H%M%S)
mkdir -p $BK
cp -a $APP/config/routes.rb $BK/routes.rb
[ -f $APP/app/controllers/sso_controller.rb ] && cp -a $APP/app/controllers/sso_controller.rb $BK/ || true
echo "$BK" > /home/ubuntu/.ultimo-backup-sso
curl -fsS -o $APP/app/controllers/sso_controller.rb https://raw.githubusercontent.com/daawgarcia/Ortholab/$COMMIT/ol1-sso/app/controllers/sso_controller.rb
grep -q "sso#entrar" $APP/config/routes.rb || sed -i "0,/routes.draw do/s//routes.draw do\n  get 'sso' => 'sso#entrar' # login unico (portal \/ ortholab 2 \/ rewards)/" $APP/config/routes.rb
( umask 077; printf '%s' "$CHAVE" > $APP/config/sso_secret )
echo "Backup em $BK. Reiniciando o Ortholab..."
sudo service puma restart
for i in $(seq 1 60); do sleep 5; c=$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:9292/users/sign_in || true); [ "$c" = "200" ] || [ "$c" = "302" ] && break; done
echo "Login normal: $(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:9292/pt-BR/users/sign_in)  (esperado 200)"
echo "Login único:  $(curl -s -o /dev/null -w '%{http_code} %{redirect_url}' 'http://127.0.0.1:9292/sso?t=teste')  (esperado 302 para users/sign_in)"
