#!/bin/bash
# Roda a cópia do Ortholab 1 dentro da rede isolada do banco de teste (sem internet).
R=/srv/olx/root; APP=/home/ubuntu/webapps/easysmile-web
PID=$(docker inspect -f '{{.State.Pid}}' ol1db)
pkill -f 'puma.*9393' || true; sleep 2
sed -i "s/^  host: .*/  host: 127.0.0.1/" $R$APP/config/database.yml
rm -f $R$APP/tmp/pids/puma.pid $R$APP/tmp/pids/puma.state
nsenter -t $PID -n chroot $R /bin/bash -c "cd $APP; while IFS= read -r l; do export \"\$l\"; done < /root/env-teste; bundle exec puma -e production -b tcp://127.0.0.1:9393 > /root/puma-teste.log 2>&1"
for i in $(seq 1 60); do sleep 5; nsenter -t $PID -n curl -s -o /dev/null http://127.0.0.1:9393/users/sign_in && { echo "no ar em $((i*5))s"; break; }; done
