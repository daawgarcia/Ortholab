#!/bin/bash
# Testa o login único numa CÓPIA do Ortholab 1 (overlay sobre o snapshot, nada no ar é tocado).
set -e
R=/srv/olx/root; APP=/home/ubuntu/webapps/easysmile-web
if ! mountpoint -q $R; then
  mkdir -p /srv/olx/upper /srv/olx/work $R
  mount -t overlay overlay -o lowerdir=/mnt/ol1,upperdir=/srv/olx/upper,workdir=/srv/olx/work $R
  for d in proc sys dev; do mount --bind /$d $R/$d; done
  cp /etc/resolv.conf $R/etc/resolv.conf
fi
DBIP=$(docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' ol1db)
cp /home/ec2-user/sso/sso_controller.rb $R$APP/app/controllers/sso_controller.rb
grep -q "sso#entrar" $R$APP/config/routes.rb || sed -i "0,/routes.draw do/s//routes.draw do\n  get 'sso' => 'sso#entrar' # login unico (portal \/ ortholab 2 \/ rewards)/" $R$APP/config/routes.rb
sed -i "s/^  host: localhost/  host: $DBIP/" $R$APP/config/database.yml
grep -E '^(AWS_BUCKET|AWS_REGION|EASYSMILE_DATABASE_USERNAME|EASYSMILE_DATABASE_PASSWORD|GEM_HOME|GEM_PATH|JAVA_HOME|MY_RUBY_HOME|PATH|RACK_ENV|RAILS_ENV|SECRET_KEY_BASE|MAILER_DEFAULT_FROM|MAILER_DEFAULT_URL_OPTIONS)=' /mnt/ol1/home/ubuntu/env-antigo.txt > $R/root/env-teste
cat >> $R/root/env-teste <<EOV
SMTP_ADDRESS=127.0.0.1
SMTP_PORT=2
AWS_ACCESS_KEY_ID=teste-invalido
AWS_SECRET_ACCESS_KEY=teste-invalido
SSO_SECRET=$(cat /home/ec2-user/sso/segredo)
EOV
pkill -f 'puma.*9393' || true
chroot $R /bin/bash -c "cd $APP; while IFS= read -r l; do export \"\$l\"; done < /root/env-teste; rm -f tmp/pids/puma.pid; nohup bundle exec puma -e production -b tcp://127.0.0.1:9393 > /root/puma-teste.log 2>&1 &"
echo "subindo (JRuby demora)..."
for i in $(seq 1 60); do sleep 5; curl -s -o /dev/null http://127.0.0.1:9393/users/sign_in && { echo "no ar em $((i*5))s"; break; }; done
tail -3 $R/root/puma-teste.log
