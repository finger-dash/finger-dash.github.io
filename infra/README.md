# AWS infrastructure

```
CloudFront (https://dxxxx.cloudfront.net)
 ├── /*   -> S3 bucket (static game)
 └── /ws  -> EC2 t4g.nano, port 8080 (Node.js + ws)
```

| Resource | Notes |
|---|---|
| CloudFront | TLS for the page and the socket, so no domain is needed to start |
| S3 (site) | Private, readable only by the distribution |
| S3 (builds) | Server releases; expire after 30 days |
| EC2 + Elastic IP | Amazon Linux 2023 (arm64), Node.js 24, systemd service |
| Security group | Port 8080 from CloudFront only. No SSH: use Session Manager |

Default region: `sa-east-1`. Override with `REGION`, and the stack name with `STACK`.

## Requirements

- AWS CLI v2, signed in to your account (`aws sts get-caller-identity` must work;
  use `AWS_PROFILE` to pick a profile).
- Permissions to manage CloudFormation, EC2, IAM roles, S3, CloudFront and
  Systems Manager.
- A default VPC in the region (or set `VPC_ID` and `SUBNET_ID`).

Never store AWS credentials in this repository.

## First deployment

```bash
scripts/budget.sh you@example.com 25   # cost alert (once per account)
scripts/infra.sh                       # create the infrastructure
scripts/deploy.sh                      # publish the server and the game
scripts/check.sh                       # page and WebSocket through CloudFront
```

## Day to day

| Task | Command |
|---|---|
| Publish everything | `scripts/deploy.sh` |
| Only the game / only the server | `scripts/deploy.sh web` / `scripts/deploy.sh server` |
| Apply template changes | `scripts/infra.sh` |
| Shell on the instance | `aws ssm start-session --region sa-east-1 --target <InstanceId>` (needs the Session Manager plugin) |
| Server logs (on the instance) | `sudo journalctl -u fingerpodium -f` |
| Remove everything | `scripts/destroy.sh` |

A failed server release rolls back to the previous one.

`infra.sh` resolves the latest Amazon Linux image. When a newer one exists, an
update replaces the instance: run `scripts/deploy.sh server` afterwards. Keep
this in mind before storing data on the instance.

## Custom domain (later)

1. Request a certificate for the domain in ACM, **region `us-east-1`**, and add the
   validation CNAME at the DNS provider.
2. `DOMAIN_NAME=fingerpodium.run CERTIFICATE_ARN=arn:... scripts/infra.sh`
3. Add an `ALIAS` record at the domain root pointing to the CloudFront domain.
4. `scripts/deploy.sh server`, so the server accepts the new origin.

## Cost

Roughly USD 10-15 per month in `sa-east-1` for a `t4g.nano`, its disk and the
public IPv4 address. CloudFront and S3 should be negligible at hobby traffic.

## Known limits

- Single instance: a deploy or restart drops open connections.
- Traffic between CloudFront and the instance is plain HTTP.
- The security group admits CloudFront's addresses, which are shared by every
  CloudFront customer; the origin check and rate limits still apply.
- Operating system updates are manual (`sudo dnf upgrade`, or replace the instance).

## Local server

```bash
cd server && npm install && npm start   # ws://localhost:8080/ws
```
