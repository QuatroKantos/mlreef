#!/bin/bash

docker-compose down

if [ "$1" = "force" ]; then
  echo "### CLEANING local docker context"
  docker-compose rm -f -v -s
  docker volume rm frontend_sock
  docker volume rm frontend_gitlab-data
  docker volume rm frontend_gitlab-runner-config
  docker volume rm frontend_gitlab-runner-data
  docker volume rm frontend_mlreefsql-data
  docker volume rm frontend_postgresql-data
  docker volume ls
  docker volume prune -f
  cp local.env local.env.bak
  rm local.env

  if [ "$GITLAB_SECRETS_SECRET_KEY_BASE" = "" ]; then
    export GITLAB_SECRETS_SECRET_KEY_BASE=secret11111111112222222222333333333344444444445555555555666666666612345
  fi

  if [ "$GITLAB_SECRETS_OTP_KEY_BASE" = "" ]; then
    export GITLAB_SECRETS_OTP_KEY_BASE=secret11111111112222222222333333333344444444445555555555666666666612345
  fi

  if [ "$GITLAB_SECRETS_DB_KEY_BASE" = "" ]; then
    export GITLAB_SECRETS_DB_KEY_BASE=secret11111111112222222222333333333344444444445555555555666666666612345
  fi

  if [ "$GITLAB_ADMIN_TOKEN" = "" ]; then
    export GITLAB_ADMIN_TOKEN=QVj_FkeHyuJURko2ggZT
  fi

  echo "# WRITING to local.env"
  echo "# generated by setup-local-environment.sh" >local.env
  {
    echo GITLAB_SECRETS_SECRET_KEY_BASE=$GITLAB_SECRETS_SECRET_KEY_BASE
    echo GITLAB_SECRETS_OTP_KEY_BASE=$GITLAB_SECRETS_OTP_KEY_BASE
    echo GITLAB_SECRETS_DB_KEY_BASE=$GITLAB_SECRETS_DB_KEY_BASE
    echo GITLAB_ADMIN_TOKEN=$GITLAB_ADMIN_TOKEN
  } >>local.env
fi

docker-compose pull

if [ ! -r local.env ]; then
  echo No local.env found! Create it manually or run this script with 'force'
  echo \"bin/setup-local-environment.sh force\" This will reset your docker stack and generate good defaults in local.env
  exit 1
else
  echo "local.env already existing, this is good! Run script with 'force' to overwrite"
fi

echo "### 1. Waiting for initial startup"
docker-compose up -d
sleep 60

docker-compose stop backend
sleep 60

echo "### MANDATORY ENV VARS:"
cat local.env

echo "### 2. Manual Steps: register runners"
echo "Please perform the manual steps for setup:"
echo "Login with root:password into your local gitlab instance"
echo "Gitlab will need some time to start (try refreshing in your browser)"
echo " "
echo "1. go to url: http://localhost:10080/admin/runners and copy the runner-registration-token"
echo "   Paste the runner-registration-token here:"

read TOKEN

echo "Removing gilab-runner config.toml if it exists"
docker exec gitlab-runner-dispatcher sh -c 'test -f /etc/gitlab-runner/config.toml && rm -f /etc/gitlab-runner/config.toml'
echo "Listing contents of configuration directory. Expecting directory to be empty."
docker exec gitlab-runner-dispatcher ls -al /etc/gitlab-runner/

echo "Registering Gitlab Runner with local Gitlab Instance"
docker exec gitlab-runner-dispatcher gitlab-runner register   \
  --non-interactive                                           \
  --url="http://gitlab:80/"                                   \
  --docker-network-mode mlreef-docker-network                 \
  --registration-token "$TOKEN"                               \
  --executor "docker"                                         \
  --docker-image alpine:latest                                \
  --docker-volumes /var/run/docker.sock:/var/run/docker.sock  \
  --description "local developer runner"                      \
  --tag-list "docker"                                         \
  --run-untagged="true"                                       \
  --locked="false"                                            \
  --access-level="not_protected"

echo Debug log the configuration file to the console
docker exec gitlab-runner-dispatcher cat /etc/gitlab-runner/config.toml

echo "Runner was registered successfully"


echo "### 3. Injecting Admin token into gitlab"
echo "Creating the admin token with GITLAB_ADMIN_TOKEN: ${GITLAB_ADMIN_TOKEN}"
chmod +x src/bin/setup-gitlab.sh
docker exec -it postgresql setup-gitlab.sh


echo "### 4. Restarting local services in right order"
docker-compose up -d gitlab
sleep 30
echo Let backend wait for gitlab restart ...
sleep 30
docker-compose stop backend nginx-proxy frontend
sleep 60
docker-compose up --detach
sleep 30
docker-compose stop backend
sleep 60
docker-compose up --detach

#echo Test connection for admin:
#curl -f -I -X GET --header "Content-Type: application/json" --header "Accept: application/json" --header "PRIVATE-TOKEN: $GITLAB_ADMIN_TOKEN" "localhost:20080/api/v1"
#curl -f -I -X GET --header "Content-Type: application/json" --header "Accept: application/json" --header "PRIVATE-TOKEN: $GITLAB_ADMIN_TOKEN" "localhost:10080/api/v4/users/1"
