#!/bin/bash
# scripts/deploy-*.sh が共通で使う設定。
# EC2 の IP アドレスは起動し直すたびに変わるので、毎回 AWS に問い合わせる

export AWS_PROFILE=${AWS_PROFILE:-taskapp}

# SSH の秘密鍵。infra/variables.tf の ssh_public_key_path と組になるもの
SSH_KEY=${SSH_KEY:-$HOME/.ssh/taskapp-ec2}
# 初めてつなぐ EC2 の鍵は自動で覚え、覚えた鍵と違うときは止める
SSH_OPTS=(-i "$SSH_KEY" -o StrictHostKeyChecking=accept-new)

tf_output() {
  terraform -chdir="$ROOT/infra" output -raw "$1"
}

HOST=$(aws ec2 describe-instances --instance-ids "$(tf_output instance_id)" \
  --query 'Reservations[0].Instances[0].PublicIpAddress' --output text)
if [[ $HOST == None ]]; then
  echo "EC2 が止まっています。起動してから実行してください（README の「EC2 を止める・起動する」）" >&2
  exit 1
fi
