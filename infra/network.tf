# 自分専用のネットワーク（VPC）
# パブリックサブネットには EC2、プライベートサブネットには RDS を置く。
# 月額のかかる NAT ゲートウェイは使わず、EC2 はパブリック IP で ECR・SSM に出ていく

data "aws_availability_zones" "available" {
  state = "available"
}

locals {
  # RDS はサブネットが 2 つの AZ にまたがっている必要があるため、2 つ使う
  azs = slice(data.aws_availability_zones.available.names, 0, 2)
}

resource "aws_vpc" "main" {
  cidr_block = "10.0.0.0/16"

  # EC2 にパブリック DNS 名を付ける（CloudFront の接続先に使う）
  enable_dns_support   = true
  enable_dns_hostnames = true

  tags = { Name = "${var.project}-vpc" }
}

resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id
  tags   = { Name = "${var.project}-igw" }
}

resource "aws_subnet" "public" {
  count = length(local.azs)

  vpc_id            = aws_vpc.main.id
  cidr_block        = cidrsubnet(aws_vpc.main.cidr_block, 8, count.index)
  availability_zone = local.azs[count.index]

  tags = { Name = "${var.project}-public-${count.index}" }
}

resource "aws_subnet" "private" {
  count = length(local.azs)

  vpc_id            = aws_vpc.main.id
  cidr_block        = cidrsubnet(aws_vpc.main.cidr_block, 8, count.index + 10)
  availability_zone = local.azs[count.index]

  tags = { Name = "${var.project}-private-${count.index}" }
}

# パブリックサブネットだけインターネットへの道を持つ。プライベートサブネットは VPC 内だけ
resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }

  tags = { Name = "${var.project}-public" }
}

resource "aws_route_table_association" "public" {
  count = length(aws_subnet.public)

  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}
