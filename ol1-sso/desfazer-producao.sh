#!/bin/bash
# Volta o Ortholab 1 exatamente como estava antes do login único.
set -e
APP=/home/ubuntu/webapps/easysmile-web
BK=$(cat /home/ubuntu/.ultimo-backup-sso)
cp -a $BK/routes.rb $APP/config/routes.rb
if [ -f $BK/sso_controller.rb ]; then cp -a $BK/sso_controller.rb $APP/app/controllers/; else rm -f $APP/app/controllers/sso_controller.rb; fi
rm -f $APP/config/sso_secret
sudo service puma restart
echo "Desfeito (backup usado: $BK)."
