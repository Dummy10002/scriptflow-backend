# 🚀 ScriptFlow AWS Deployment Guide

This guide covers how to deploy the ScriptFlow Backend to AWS EC2 (Free Tier eligible) and configure S3 for image storage.

## 📋 Prerequisites

1.  **AWS Account**: [Create one here](https://aws.amazon.com/) (Free Tier eligible).
2.  **AWS CLI** (Optional but helpful): installed on your local machine.
3.  **SSH Client**: (PuTTY on Windows or terminal).

---

## Part 1: S3 Bucket Setup (Image Storage)

1.  Log in to **AWS Console** > **S3**.
2.  Click **Create bucket**.
3.  **Bucket name**: `scriptflow-images-<your-name>` (must be unique).
4.  **Region**: `ap-south-1` (Mumbai) or your preferred region.
5.  **Object Ownership**: Select **ACLs enabled** -> **Object writer**.
    *   *Why?* We use public ACLs to make images viewable by ManyChat.
6.  **Block Public Access settings**: Uncheck **"Block all public access"**.
    *   Check the warning box "I acknowledge that...".
7.  Click **Create bucket**.

---

## Part 2: IAM User Setup (Security)

1.  Go to **IAM** > **Users** > **Create user**.
2.  **User name**: `scriptflow-s3-uploader`.
3.  **Permissions**:
    *   Select **Attach policies directly**.
    *   Search for `AmazonS3FullAccess` (easiest) OR create a custom policy just for your bucket (more secure).
4.  Create user.
5.  Go to the user -> **Security credentials** tab.
6.  Click **Create access key** -> Select "Application running outside AWS".
7.  **COPY the Access Key ID and Secret Access Key**. You will need these later.

---

## Part 3: EC2 Instance Setup (The Server)

1.  Go to **EC2** > **Launch Instance**.
2.  **Name**: `ScriptFlow-Backend`.
3.  **OS Image**: **Ubuntu Server 24.04 LTS** (Free tier eligible).
4.  **Instance Type**: `t2.micro` (Free tier eligible - 1GB RAM).
5.  **Key Pair**: Create new key pair -> `scriptflow-key` -> Download `.pem` file.
6.  **Network Settings**:
    *   Check **Allow SSH traffic from Anywhere**.
    *   Check **Allow HTTP traffic from the internet**.
    *   Check **Allow HTTPS traffic from the internet**.
7.  Click **Launch Instance**.

---

## Part 4: Server Configuration

1.  **Connect to your instance**:
    ```bash
    ssh -i scriptflow-key.pem ubuntu@<your-ec2-public-ip>
    ```

2.  **Install Docker & Git**:
    ```bash
    # Update system
    sudo apt-get update
    sudo apt-get install -y docker.io git curl

    # Start Docker
    sudo systemctl start docker
    sudo systemctl enable docker
    
    # Add user to docker group (avoid sudo)
    sudo usermod -aG docker $USER
    # You may need to logout and login again for this to take effect
    ```

3.  **Clone the Repository**:
    ```bash
    git clone <your-repo-url> scriptflow
    cd scriptflow
    ```

4.  **Environment Variables**:
    Create a `.env` file:
    ```bash
    nano .env
    ```
    Paste your production config (from `.env.example`):
    ```ini
    PORT=3000
    NODE_ENV=production
    
    # Database
    MONGODB_URI=...
    REDIS_URL=...

    # Keys
    GEMINI_API_KEY=...
    MANYCHAT_API_KEY=...
    
    # AWS Config
    AWS_REGION=ap-south-1
    AWS_ACCESS_KEY_ID=...
    AWS_SECRET_ACCESS_KEY=...
    S3_BUCKET_NAME=...
    IMAGE_PROVIDER=s3
    
    # Analysis
    ANALYSIS_MODE=hybrid
    ```

---

## Part 5: Deployment

1.  **Install dependencies** (required for build step):
    ```bash
    npm install @aws-sdk/client-s3 
    # Or just let Docker handle it if packaged in package.json
    ```

2.  **Build and Run with Docker**:
    We have a special optimized Dockerfile for AWS (`Dockerfile.aws`).

    ```bash
    # Build the image
    docker build -f Dockerfile.aws -t scriptflow-app .

    # Run the container (detached mode, auto-restart)
    docker run -d \
      --name scriptflow \
      --restart unless-stopped \
      -p 80:3000 \
      --env-file .env \
      scriptflow-app
    ```
    *Note: mapping port 80 to 3000 allows you to access typical web URLs without `:3000`.*

3.  **Verify**:
    Visit `http://<your-ec2-public-ip>/health`
    You should see `{"status":"ok"}`.

---

## Part 6: Final Integration

1.  **Update ManyChat**: Change your External Request URL to:
    `http://<your-ec2-public-ip>/api/v1/script/generate`
    
    *(Later, you can set up a domain + HTTPS using Nginx + Certbot)*

---

## Troubleshooting

-   **Memory Issues**: If the build crashes, t2.micro might be out of RAM.
    *   *Solution*: Create a Swap file:
        ```bash
        sudo fallocate -l 1G /swapfile
        sudo chmod 600 /swapfile
        sudo mkswap /swapfile
        sudo swapon /swapfile
        ```
-   **Logs**: Check generic logs:
    ```bash
    docker logs -f scriptflow
    ```

## Updates
To deploy new code:
```bash
git pull
docker build -f Dockerfile.aws -t scriptflow-app .
docker stop scriptflow
docker rm scriptflow
docker run -d --name scriptflow --restart unless-stopped -p 80:3000 --env-file .env scriptflow-app
```
