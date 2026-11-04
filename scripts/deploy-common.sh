#!/bin/bash
# scripts/deploy-*.sh が共通で使う設定。EC2 の IP アドレスは terraform output から読む

export AWS_PROFILE=${AWS_PROFILE:-taskapp}

# SSH の秘密鍵。infra/variables.tf の ssh_public_key_path と組になるもの
SSH_KEY=${SSH_KEY:-$HOME/.ssh/taskapp-ec2}
# 初めてつなぐ EC2 の鍵は自動で覚え、覚えた鍵と違うときは止める
SSH_OPTS=(-i "$SSH_KEY" -o StrictHostKeyChecking=accept-new)

tf_output() {
  terraform -chdir="$ROOT/infra" output -raw "$1"
}

HOST=$(tf_output public_ip)
