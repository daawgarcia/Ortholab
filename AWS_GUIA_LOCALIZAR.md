# COMO ENCONTRAR IP/DNS E CHAVE .pem NA AWS

## Passo 1: Acessar o Console AWS

1. Acesse: https://console.aws.amazon.com/
2. Faça login com sua conta

---

## Passo 2: Encontrar o IP/DNS da Instância

### Caminho:
**Console AWS** → **Serviços** → **EC2** → **Instâncias**

Ou digite "EC2" na barra de pesquisa no topo:

```
┌─────────────────────────────────────────────────────────┐
│  🔍 Pesquisar serviços...    [Digite: EC2]             │
└─────────────────────────────────────────────────────────┘
```

### Na página de Instâncias:

Você verá uma lista assim:

```
┌─────────────────────────────────────────────────────────────────────┐
│  Nome da instância    │  ID da instância  │  Estado  │  IP Público │
├─────────────────────────────────────────────────────────────────────┤
│  ortholab-prod        │  i-0abc123...     │  ● Em    │  54.233...  │
│  ortholab-server      │  i-0xyz789...     │    execu-│  18.228...  │
│  (outras...)          │                   │    ção   │             │
└─────────────────────────────────────────────────────────────────────┘
```

### O que anotar:

Clique na instância do Ortholab e anote:

| Informação | Onde encontrar | Exemplo |
|------------|----------------|---------|
| **IP Público** | Painel de detalhes → "IPv4 Público" | 54.233.123.45 |
| **DNS Público** | Painel de detalhes → "DNS IPv4 Público" | ec2-54-233-123-45.sa-east-1.compute.amazonaws.com |

**Use o DNS Público** (é mais confiável que o IP)

---

## Passo 3: Baixar a Chave .pem

### Opção A: Se você já tem a chave (mais comum)

A chave foi criada quando a instância foi lançada. Procure no seu computador:

**Windows:**
- `C:\Users\SeuUsuario\Downloads\`
- `C:\Users\SeuUsuario\Documents\`
- Área de Trabalho

**Mac/Linux:**
- `~/Downloads/`
- `~/Documents/`
- `~/.ssh/`

Nome típico: `ortholab-key.pem`, `aws-key.pem`, `estheticaligner.pem`

---

### Opção B: Criar nova chave (se perdeu a original)

⚠️ **ATENÇÃO:** Se criar nova chave, precisará substituir na instância (requer acesso via outro método)

1. No console AWS, vá em: **EC2** → **Pares de chaves** (Key Pairs)
   ```
   Menu lateral EC2:
   ├── Instâncias
   ├── Imagens
   ├── Elastic Block Store
   ├── Rede e segurança
   │   ├── Security Groups
   │   └── Pares de chaves  ← CLIQUE AQUI
   ```

2. Clique em **"Criar par de chaves"**

3. Preencha:
   - **Nome:** `ortholab-backup-key`
   - **Tipo:** RSA
   - **Formato:** .pem

4. Clique em **"Criar par de chaves"**

5. O arquivo será baixado automaticamente!

---

### Opção C: Ver qual chave a instância usa

1. Na lista de instâncias, clique na instância do Ortholab
2. Abaixo, na aba **"Detalhes"**, procure:
   ```
   Nome do par de chaves: ortholab-production-key
                          ↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑
                          Este é o nome da chave!
   ```

3. Vá em **Pares de chaves** e procure esse nome

---

## 📋 Resumo - O que você precisa

| Item | Onde encontrar | Formato |
|------|----------------|---------|
| **IP ou DNS** | EC2 → Instâncias → Detalhes | 54.233.xxx.xxx ou ec2-xxx.amazonaws.com |
| **Chave .pem** | Seu computador ou EC2 → Pares de chaves | arquivo.pem |
| **Usuário** | Geralmente "ubuntu" ou "ec2-user" | ubuntu |

---

## 🔍 Não consegue achar?

Me envie:
1. Um print da tela de **Instâncias EC2** (com os dados visíveis)
2. Ou me diga: qual o nome da instância que aparece na lista?

Assim posso te guiar exatamente onde clicar!
