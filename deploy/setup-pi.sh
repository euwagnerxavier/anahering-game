#!/usr/bin/env bash
# Instala o Reino de Heringuia num Raspberry Pi 5 (Raspberry Pi OS Lite 64-bit / Debian Bookworm).
# Uso (a partir da raiz do repositório, no Pi):  bash deploy/setup-pi.sh
# Rodar de novo atualiza o código, recompila e reinicia o serviço (idempotente).
set -euo pipefail

APP_DIR=/opt/anahering
DATA_DIR=/var/lib/anahering
ENV_FILE=/etc/anahering.env
SRC_DIR="$(cd "$(dirname "$0")/.." && pwd)"

echo "==> Pacotes do sistema"
sudo apt-get update
sudo apt-get install -y git curl rsync ufw unattended-upgrades sqlite3 ca-certificates

echo "==> Node.js 22 LTS"
if ! node -v 2>/dev/null | grep -qE '^v(2[2-9]|[3-9][0-9])\.'; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi
node -v

echo "==> Usuário de serviço e diretórios"
id anahering >/dev/null 2>&1 || sudo useradd --system --home "$APP_DIR" --shell /usr/sbin/nologin anahering
sudo mkdir -p "$APP_DIR" "$DATA_DIR"
sudo chown anahering:anahering "$DATA_DIR"
sudo chmod 750 "$DATA_DIR"

echo "==> Código"
sudo rsync -a --delete --exclude node_modules --exclude .git --exclude server/data --exclude client/dist "$SRC_DIR"/ "$APP_DIR"/
cd "$APP_DIR"
sudo npm ci --no-audit --no-fund || { echo "npm ci falhou (lockfile de outra plataforma?) — usando npm install"; sudo rm -rf node_modules; sudo npm install --no-audit --no-fund; }
sudo npm run build
sudo chown -R root:root "$APP_DIR"

echo "==> Configuração ($ENV_FILE)"
if [ ! -f "$ENV_FILE" ]; then
  sudo tee "$ENV_FILE" >/dev/null <<EOF
NODE_ENV=production
HOST=127.0.0.1
PORT=3000
DB_PATH=$DATA_DIR/anahering.db
IP_SALT=$(openssl rand -hex 16)
ADMIN_TOKEN=$(openssl rand -hex 24)
TRUST_CLOUDFLARE=true
# ALLOWED_ORIGINS=https://rainha.seudominio.com
MAX_PLAYERS=100
MAX_CONN_PER_IP=3
DECREES_PER_DAY=20
EOF
  sudo chmod 640 "$ENV_FILE"
  sudo chown root:anahering "$ENV_FILE"
  echo "   ADMIN_TOKEN gerado — veja com: sudo grep ADMIN_TOKEN $ENV_FILE"
fi

echo "==> Serviço systemd"
sudo cp "$APP_DIR/deploy/anahering.service" /etc/systemd/system/anahering.service
sudo systemctl daemon-reload
sudo systemctl enable anahering
sudo systemctl restart anahering
sleep 2
curl -fsS http://127.0.0.1:3000/api/health && echo

echo "==> Firewall (nada entra além de SSH; o Cloudflare Tunnel é conexão de saída)"
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow OpenSSH
sudo ufw --force enable

echo "==> Atualizações automáticas de segurança"
sudo dpkg-reconfigure -f noninteractive unattended-upgrades

echo "==> Backup diário do banco (03:30)"
echo "30 3 * * * anahering sqlite3 $DATA_DIR/anahering.db \".backup '$DATA_DIR/backup-\$(date +\\%u).db'\"" | sudo tee /etc/cron.d/anahering-backup >/dev/null

echo "==> cloudflared"
if ! command -v cloudflared >/dev/null; then
  curl -fsSL -o /tmp/cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64.deb
  sudo dpkg -i /tmp/cloudflared.deb
fi

cat <<'MSG'

Pronto! O servidor roda em http://127.0.0.1:3000 (somente local).

Para publicar na internet com o Cloudflare Tunnel:
  * Teste rápido, sem conta (URL temporária *.trycloudflare.com):
      cloudflared tunnel --url http://127.0.0.1:3000
  * Definitivo, com seu domínio na Cloudflare:
      cloudflared tunnel login
      cloudflared tunnel create anahering
      cloudflared tunnel route dns anahering rainha.seudominio.com
      # edite deploy/cloudflared-config.yml (ID do túnel e hostname) e copie:
      sudo mkdir -p /etc/cloudflared
      sudo cp ~/.cloudflared/<ID>.json /etc/cloudflared/
      sudo cp /opt/anahering/deploy/cloudflared-config.yml /etc/cloudflared/config.yml
      sudo cloudflared service install
MSG
