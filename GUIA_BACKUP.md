# GUIA DE BACKUP DO ORTHOLAB - AWS PARA COMPUTADOR LOCAL

## ⚠️ IMPORTANTE
Este processo **NÃO ALTERA NADA** no servidor AWS. É apenas uma cópia/leitura dos dados.

---

## PRÉ-REQUISITOS

### 1. Windows
- Instalar **Git Bash**: https://git-scm.com/download/win
- Ou usar **WSL** (Windows Subsystem for Linux)

### 2. Mac
- Terminal já vem instalado
- Instalar rsync (se não tiver): `brew install rsync`

### 3. Linux
- Terminal já vem com tudo necessário

---

## PASSO A PASSO

### ETAPA 1: Pegar informações da AWS

1. Acesse: https://console.aws.amazon.com/ec2/
2. Vá em **Instances** (Instâncias)
3. Selecione a instância do Ortholab
4. Anote:
   - **IP Público** ou **DNS Público** (ex: `ec2-54-233-123-45.sa-east-1.compute.amazonaws.com`)
   - **Nome da chave** (ex: `ortholab-key`)

5. Baixe a chave SSH (.pem):
   - Vá em **Key Pairs** (Pares de chaves)
   - Encontre a chave da instância
   - Baixe o arquivo `.pem`
   - **Guarde em local seguro!**

---

### ETAPA 2: Configurar o script

1. Abra o arquivo `backup_ortholab.sh` em um editor de texto
2. Altere estas linhas:

```bash
# Linha 15 - Caminho da chave .pem
AWS_KEY_PATH="$HOME/Downloads/ortholab-key.pem"

# Linhas 18-19 - Usuário e IP da AWS
AWS_USER="ubuntu"
AWS_IP="ec2-xxx-xxx-xxx-xxx.sa-east-1.compute.amazonaws.com"
```

**Exemplo:**
```bash
AWS_KEY_PATH="$HOME/Downloads/ortholab-production.pem"
AWS_USER="ubuntu"
AWS_IP="ec2-54-233-123-45.sa-east-1.compute.amazonaws.com"
```

---

### ETAPA 3: Executar o backup

#### No Windows (Git Bash):
1. Abra o **Git Bash**
2. Navegue até a pasta do script:
   ```bash
   cd /c/Users/SeuUsuario/Downloads
   ```
3. Execute:
   ```bash
   bash backup_ortholab.sh
   ```

#### No Mac/Linux:
1. Abra o **Terminal**
2. Navegue até a pasta:
   ```bash
   cd ~/Downloads
   ```
3. Dê permissão de execução:
   ```bash
   chmod +x backup_ortholab.sh
   ```
4. Execute:
   ```bash
   ./backup_ortholab.sh
   ```

---

### ETAPA 4: Aguardar o download

O script vai:
1. ✅ Testar conexão com AWS
2. ✅ Fazer backup do banco de dados (PostgreSQL)
3. ✅ Baixar todos os arquivos de upload
4. ✅ Salvar configurações (.env)
5. ✅ Coletar informações do servidor

**Tempo estimado:**
- Banco: 1-5 minutos
- Arquivos: 10 minutos a 2 horas (depende da quantidade)

---

### ETAPA 5: Verificar o backup

Após concluir, você terá uma pasta como:
```
ortholab_backup_20250127_143022/
├── ortholab_database.sql      ← Banco de dados
├── uploads/                   ← Arquivos (fotos, STL, etc.)
│   ├── patients/
│   ├── cases/
│   └── ...
├── env_backend.txt            ← Configurações
├── server_info.txt            ← Informações do servidor
└── README.txt                 ← Resumo
```

---

## SOLUÇÃO DE PROBLEMAS

### Erro: "Permission denied (publickey)"
**Solução:**
```bash
chmod 400 ~/Downloads/ortholab-key.pem
```

### Erro: "Could not resolve hostname"
**Solução:** Verifique se o IP/hostname está correto

### Erro: "Connection timed out"
**Solução:** 
- Verifique se a instância EC2 está ligada
- Verifique se o Security Group permite SSH (porta 22)
- Verifique se está conectado na VPN (se necessário)

### Erro: "pg_dump: command not found"
**Solução:** O PostgreSQL client não está instalado no servidor, mas o script tentará usar o que estiver disponível

---

## APÓS O BACKUP

Você pode usar esses arquivos para:
1. Restaurar em um servidor de staging/teste
2. Migrar para outro servidor
3. Ter como backup de segurança

Para restaurar em outro servidor, use o script `restore_ortholab.sh` (que posso criar também).

---

## SEGURANÇA

⚠️ **Atenção:**
- A chave `.pem` dá acesso total ao servidor. Guarde com segurança!
- O arquivo `ortholab_database.sql` contém todos os dados. Criptografe se necessário!
- Os arquivos `.env` contêm senhas e chaves de API. Não compartilhe!

---

## PRECISA DE AJUDA?

Se encontrar problemas, me envie:
1. O erro exato que apareceu
2. Em qual etapa parou
3. Se consegue acessar a AWS normalmente
