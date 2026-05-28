# COMO BAIXAR A CHAVE .PEM DA AWS (SE NÃO TIVER NO COMPUTADOR)

## Método 1: Verificar se existe no AWS (mais fácil)

### Passo 1: Acesse o console AWS
https://console.aws.amazon.com/

### Passo 2: Vá em EC2 → Pares de Chaves

Caminho:
```
Console AWS
    ↓
Serviços → EC2
    ↓
Menu lateral: "Pares de chaves" (Key Pairs)
    ↓
Veja a lista de chaves
```

### Passo 3: Procure na lista

Você verá algo assim:

```
┌─────────────────────────────────────────────────────────┐
│  Nome do par de chaves        │  Tipo  │  Fingerprint  │
├─────────────────────────────────────────────────────────┤
│  ortholab_virginia            │  rsa   │  1a:2b:3c...  │  ← PROVAVELMENTE É ESSA
│  aws-key-2023                 │  rsa   │  4d:5e:6f...  │
│  minha-chave                  │  rsa   │  7g:8h:9i...  │
└─────────────────────────────────────────────────────────┘
```

A chave que você viu na instância começava com **"ortholab_virg"**, então provavelmente é:
- `ortholab_virginia`
- `ortholab_virg`
- `ortholab_virginia_key`

---

## ⚠️ IMPORTANTE:

**A AWS NÃO permite baixar a chave novamente depois de criada!**

Se a chave não estiver salva no seu computador, você tem 2 opções:

---

## Opção A: Criar NOVA chave (Recomendado se não achar)

### Passo 1: Criar nova chave
1. Em **Pares de chaves**, clique em **"Criar par de chaves"**

2. Preencha:
   ```
   Nome: ortholab-backup-key
   Tipo: RSA
   Formato: .pem
   ```

3. Clique em **"Criar par de chaves"**

4. O arquivo será baixado **automaticamente**!

   💾 Salve em: `Downloads/ortholab-backup-key.pem`

### Passo 2: Associar à instância
⚠️ **Isso requer acesso à instância** (você precisa de outra forma de acessar)

Se não conseguir, use a **Opção B** abaixo.

---

## Opção B: Fazer backup SEM chave SSH (via AWS Systems Manager)

Se não tiver a chave e não puder criar nova, use o **AWS Systems Manager** (Session Manager):

### Passo 1: Habilitar Session Manager
1. Na instância EC2, clique em **"Connect"** (botão laranja no topo)

2. Escolha a aba **"Session Manager"**

3. Clique em **"Connect"**

4. Se abrir um terminal no navegador, ótimo! Senão, precisa habilitar o agente SSM.

### Passo 2: Fazer backup manual
No terminal que abrir, execute:

```bash
# Criar pasta de backup
mkdir -p /tmp/ortholab_backup
cd /tmp/ortholab_backup

# Backup do banco (ajuste a URL se necessário)
export PGPASSWORD="sua_senha_do_banco"
pg_dump -h localhost -U postgres ortholab > database.sql

# Compactar uploads
tar -czvf uploads.tar.gz /var/www/ortholab/uploads

# Ver o que temos
ls -lah
```

### Passo 3: Baixar os arquivos
Use o **AWS S3** como intermediário:

```bash
# Instalar AWS CLI se não tiver
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install

# Enviar para S3
aws s3 cp /tmp/ortholab_backup/database.sql s3://seu-bucket/backup/
aws s3 cp /tmp/ortholab_backup/uploads.tar.gz s3://seu-bucket/backup/
```

Depois baixe do S3 para seu computador.

---

## Opção C: Pedir ajuda a quem tem acesso

Se outra pessoa da equipe tem a chave `.pem`, peça para:
1. Enviar o arquivo para você (de forma segura)
2. Ou executar o backup do lado deles

---

## 🚀 RESUMO RÁPIDO

| Situação | Solução |
|----------|---------|
| **A chave existe no AWS** | Peça para quem criou a instância (provavelmente tem a chave) |
| **Ninguém tem a chave** | Crie nova chave (Opção A) + substitua na instância |
| **Não consegue substituir** | Use Session Manager (Opção B) |
| **Está complicado** | Me avise que crio um script alternativo |

---

## ❓ PRÓXIMO PASSO

**Quem criou a instância EC2 do Ortholab?** Essa pessoa provavelmente tem o arquivo `.pem` original.

Ou prefere que eu te guie pela **Opção B** (Session Manager) que não precisa de chave?
