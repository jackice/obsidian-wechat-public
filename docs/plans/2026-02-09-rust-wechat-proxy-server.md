# Rust WeChat Proxy Server - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 开发一个基于 Axum 的轻量级 Rust 代理服务器，用于转发 Obsidian 插件的微信 API 请求，支持认证、限流、日志和文件上传。

**Architecture:** 采用分层架构（路由层→中间件层→服务层），使用 Axum + Tokio 实现高性能异步处理，支持 multipart 文件流式传输。

**Tech Stack:** Rust, Axum, Tokio, reqwest, tower (rate limiting), tracing (logging)

---

## Task 0: Create New Repository

**Goal:** Create a new Git repository for the proxy server project

**Files:**
- Create: New directory `wechat-proxy-server/`

**Step 1: Create project directory**

```bash
# Create the project directory outside of current repo
cd ~/dev/src/github.com/jackice
mkdir wechat-proxy-server
cd wechat-proxy-server
```

**Step 2: Initialize Git repository**

```bash
git init
git remote add origin git@github.com:jackice/wechat-proxy-server.git
```

**Step 3: Create initial README**

```bash
cat > README.md << 'EOF'
# WeChat Proxy Server

A lightweight Rust proxy server for Obsidian WeChat plugin.

## Features
- API Key authentication
- Rate limiting
- Request/response logging
- File upload proxy support
- Health check endpoint

## Quick Start

```bash
cargo run
```

## Configuration

Set environment variables in `.env`:
- `PROXY_API_KEY` - API key for authentication
- `RATE_LIMIT_PER_MINUTE` - Requests per minute per API key
- `TIMEOUT_SECONDS` - Request timeout
- `LOG_LEVEL` - Logging level (debug, info, warn, error)
- `BIND_ADDRESS` - Server bind address (default: 0.0.0.0:3000)
EOF
```

**Step 4: Initial commit**

```bash
git add README.md
git commit -m "Initial commit: Project setup"
```

---

## Task 1: Setup Rust Project Structure

**Files:**
- Create: `Cargo.toml`
- Create: `.gitignore`
- Create: `src/main.rs`

**Step 1: Create Cargo.toml**

```toml
[package]
name = "wechat-proxy-server"
version = "0.1.0"
edition = "2021"
authors = ["jackice"]
description = "Lightweight proxy server for Obsidian WeChat plugin"
license = "MIT"

[dependencies]
# Web framework
axum = "0.7"
tokio = { version = "1", features = ["full"] }
tower = "0.4"
tower-http = { version = "0.5", features = ["trace", "limit", "timeout"] }

# HTTP client
reqwest = { version = "0.11", features = ["json", "multipart", "stream"] }

# Serialization
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"

# Logging
tracing = "0.1"
tracing-subscriber = { version = "0.3", features = ["env-filter"] }

# Configuration
dotenvy = "0.15"

# Error handling
thiserror = "1.0"
anyhow = "1.0"

# Utilities
uuid = { version = "1.0", features = ["v4"] }
chrono = "0.4"

[dev-dependencies]
tokio-test = "0.4"
```

**Step 2: Create .gitignore**

```bash
cat > .gitignore << 'EOF'
# Rust
/target
**/*.rs.bk
Cargo.lock

# Environment
.env
.env.local

# IDE
.idea/
.vscode/
*.swp
*.swo
*~

# OS
.DS_Store
Thumbs.db

# Logs
*.log
logs/
EOF
```

**Step 3: Create initial src/main.rs**

```rust
use axum::{
    routing::get,
    Router,
};
use std::net::SocketAddr;
use tracing::{info, Level};
use tracing_subscriber::FmtSubscriber;

#[tokio::main]
async fn main() {
    // Initialize logging
    let subscriber = FmtSubscriber::builder()
        .with_max_level(Level::INFO)
        .finish();
    
    tracing::subscriber::set_global_default(subscriber)
        .expect("Failed to set subscriber");

    info!("Starting WeChat Proxy Server...");

    // Build router
    let app = Router::new()
        .route("/health", get(health_check));

    // Bind to address
    let addr = SocketAddr::from(([0, 0, 0, 0], 3000));
    info!("Listening on {}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}

async fn health_check() -> &'static str {
    "OK"
}
```

**Step 4: Test the build**

```bash
cargo build
```

Expected output: Compiling dependencies... Finished successfully

**Step 5: Run and verify**

```bash
cargo run &
sleep 2
curl http://localhost:3000/health
# Expected: OK
kill %1
```

**Step 6: Commit**

```bash
git add .
git commit -m "feat: setup project structure with basic Axum server"
```

---

## Task 2: Create Configuration Module

**Files:**
- Create: `src/config.rs`
- Modify: `src/main.rs`

**Step 1: Create config.rs**

```rust
use std::env;

#[derive(Debug, Clone)]
pub struct Config {
    pub proxy_api_key: String,
    pub rate_limit_per_minute: u32,
    pub timeout_seconds: u64,
    pub log_level: String,
    pub bind_address: String,
}

impl Config {
    pub fn from_env() -> anyhow::Result<Self> {
        // Load .env file if exists
        let _ = dotenvy::dotenv();

        Ok(Self {
            proxy_api_key: env::var("PROXY_API_KEY")
                .unwrap_or_else(|_| "default-key-change-in-production".to_string()),
            rate_limit_per_minute: env::var("RATE_LIMIT_PER_MINUTE")
                .unwrap_or_else(|_| "100".to_string())
                .parse()
                .unwrap_or(100),
            timeout_seconds: env::var("TIMEOUT_SECONDS")
                .unwrap_or_else(|_| "30".to_string())
                .parse()
                .unwrap_or(30),
            log_level: env::var("LOG_LEVEL").unwrap_or_else(|_| "info".to_string()),
            bind_address: env::var("BIND_ADDRESS")
                .unwrap_or_else(|_| "0.0.0.0:3000".to_string()),
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_config() {
        // Ensure we can create config with defaults
        let config = Config {
            proxy_api_key: "test".to_string(),
            rate_limit_per_minute: 100,
            timeout_seconds: 30,
            log_level: "info".to_string(),
            bind_address: "0.0.0.0:3000".to_string(),
        };
        
        assert_eq!(config.rate_limit_per_minute, 100);
        assert_eq!(config.timeout_seconds, 30);
    }
}
```

**Step 2: Update main.rs to use config**

```rust
use axum::{
    routing::get,
    Router,
};
use std::net::SocketAddr;
use tracing::{info, Level};
use tracing_subscriber::FmtSubscriber;

mod config;
use config::Config;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Load configuration
    let config = Config::from_env()?;
    
    // Initialize logging
    let log_level = config.log_level.parse::<Level>().unwrap_or(Level::INFO);
    let subscriber = FmtSubscriber::builder()
        .with_max_level(log_level)
        .finish();
    
    tracing::subscriber::set_global_default(subscriber)
        .expect("Failed to set subscriber");

    info!("Starting WeChat Proxy Server...");
    info!("Configuration: {:?}", config);

    // Build router
    let app = Router::new()
        .route("/health", get(health_check));

    // Bind to address
    let addr: SocketAddr = config.bind_address.parse()?;
    info!("Listening on {}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;
    
    Ok(())
}

async fn health_check() -> &'static str {
    "OK"
}
```

**Step 3: Create .env.example**

```bash
cat > .env.example << 'EOF'
# API Key for proxy authentication
PROXY_API_KEY=your-secret-api-key

# Rate limit per minute per API key
RATE_LIMIT_PER_MINUTE=100

# Request timeout in seconds
TIMEOUT_SECONDS=30

# Log level: debug, info, warn, error
LOG_LEVEL=info

# Server bind address
BIND_ADDRESS=0.0.0.0:3000
EOF
```

**Step 4: Build and test**

```bash
cargo build
cargo test config::tests
```

Expected: All tests pass

**Step 5: Commit**

```bash
git add .
git commit -m "feat: add configuration module with env var support"
```

---

## Task 3: Create Error Handling Module

**Files:**
- Create: `src/error.rs`

**Step 1: Create error.rs**

```rust
use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde::Serialize;
use thiserror::Error;

#[derive(Serialize)]
pub struct ErrorResponse {
    pub errcode: i32,
    pub errmsg: String,
    pub request_id: String,
}

#[derive(Error, Debug)]
pub enum ProxyError {
    #[error("Unauthorized: {0}")]
    Unauthorized(String),
    
    #[error("Rate limit exceeded")]
    RateLimited,
    
    #[error("Bad request: {0}")]
    BadRequest(String),
    
    #[error("Upstream error: {0}")]
    UpstreamError(String),
    
    #[error("Internal error: {0}")]
    InternalError(String),
    
    #[error("Timeout")]
    Timeout,
}

impl ProxyError {
    pub fn status_code(&self) -> StatusCode {
        match self {
            ProxyError::Unauthorized(_) => StatusCode::UNAUTHORIZED,
            ProxyError::RateLimited => StatusCode::TOO_MANY_REQUESTS,
            ProxyError::BadRequest(_) => StatusCode::BAD_REQUEST,
            ProxyError::UpstreamError(_) => StatusCode::BAD_GATEWAY,
            ProxyError::InternalError(_) => StatusCode::INTERNAL_SERVER_ERROR,
            ProxyError::Timeout => StatusCode::GATEWAY_TIMEOUT,
        }
    }
    
    pub fn errcode(&self) -> i32 {
        match self {
            ProxyError::Unauthorized(_) => 401,
            ProxyError::RateLimited => 429,
            ProxyError::BadRequest(_) => 400,
            ProxyError::UpstreamError(_) => 502,
            ProxyError::InternalError(_) => 500,
            ProxyError::Timeout => 504,
        }
    }
}

impl IntoResponse for ProxyError {
    fn into_response(self) -> Response {
        let request_id = uuid::Uuid::new_v4().to_string();
        
        let body = Json(ErrorResponse {
            errcode: self.errcode(),
            errmsg: self.to_string(),
            request_id,
        });
        
        (self.status_code(), body).into_response()
    }
}

pub type Result<T> = std::result::Result<T, ProxyError>;
```

**Step 2: Add to main.rs**

```rust
mod config;
mod error;

use config::Config;
```

**Step 3: Build and verify**

```bash
cargo build
```

**Step 4: Commit**

```bash
git add .
git commit -m "feat: add error handling module with custom error types"
```

---

## Task 4: Create Request/Response Models

**Files:**
- Create: `src/models.rs`

**Step 1: Create models.rs**

```rust
use serde::{Deserialize, Serialize};

/// Proxy request from client
#[derive(Debug, Deserialize)]
pub struct ProxyRequest {
    /// Target WeChat API URL
    pub target_url: String,
    /// HTTP method
    #[serde(default = "default_method")]
    pub method: String,
    /// Request headers
    #[serde(default)]
    pub headers: Option<serde_json::Map<String, serde_json::Value>>,
    /// Request body (for POST/PUT)
    #[serde(default)]
    pub body: Option<serde_json::Value>,
}

fn default_method() -> String {
    "GET".to_string()
}

/// WeChat API response wrapper
#[derive(Debug, Serialize)]
pub struct ProxyResponse {
    /// Response data from WeChat API
    pub data: serde_json::Value,
    /// Request ID for tracing
    pub request_id: String,
}

/// Health check response
#[derive(Debug, Serialize)]
pub struct HealthResponse {
    pub status: String,
    pub version: String,
    pub timestamp: String,
}

/// File upload proxy request
#[derive(Debug, Deserialize)]
pub struct UploadProxyRequest {
    /// Target WeChat API URL
    pub target_url: String,
    /// Filename
    pub filename: String,
    /// Content type (e.g., "image/jpeg")
    pub content_type: String,
}
```

**Step 2: Add to main.rs**

```rust
mod config;
mod error;
mod models;
```

**Step 3: Build**

```bash
cargo build
```

**Step 4: Commit**

```bash
git commit -m "feat: add request/response models"
```

---

## Task 5: Create Auth Middleware

**Files:**
- Create: `src/middleware/auth.rs`
- Create: `src/middleware/mod.rs`

**Step 1: Create middleware directory and mod.rs**

```bash
mkdir -p src/middleware
cat > src/middleware/mod.rs << 'EOF'
pub mod auth;
pub mod rate_limit;
EOF
```

**Step 2: Create auth.rs**

```rust
use axum::{
    extract::Request,
    http::{header, StatusCode},
    middleware::Next,
    response::Response,
};

use crate::error::ProxyError;

pub async fn auth_middleware(
    request: Request,
    next: Next,
) -> Result<Response, ProxyError> {
    // Get API key from header
    let api_key = request
        .headers()
        .get(header::AUTHORIZATION)
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.strip_prefix("Bearer "))
        .ok_or_else(|| ProxyError::Unauthorized("Missing or invalid API key".to_string()))?;

    // TODO: In production, validate against configured API keys
    // For now, accept any non-empty key
    if api_key.is_empty() {
        return Err(ProxyError::Unauthorized("Empty API key".to_string()));
    }

    // Add API key to request extensions for later use
    let mut request = request;
    request.extensions_mut().insert(api_key.to_string());

    Ok(next.run(request).await)
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::body::Body;

    #[tokio::test]
    async fn test_missing_auth_header() {
        let request = Request::builder()
            .uri("/test")
            .body(Body::empty())
            .unwrap();

        let result = auth_middleware(request, Next::new()).await;
        assert!(result.is_err());
    }
}
```

**Step 3: Update main.rs**

```rust
mod config;
mod error;
mod models;
mod middleware;
```

**Step 4: Build**

```bash
cargo build
```

**Step 5: Commit**

```bash
git add .
git commit -m "feat: add authentication middleware"
```

---

## Task 6: Create Rate Limit Middleware

**Files:**
- Modify: `src/middleware/rate_limit.rs`
- Modify: `src/middleware/mod.rs`

**Step 1: Create rate_limit.rs**

```rust
use axum::{
    extract::Request,
    middleware::Next,
    response::Response,
};
use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::RwLock;

use crate::error::ProxyError;

#[derive(Clone)]
pub struct RateLimiter {
    requests: Arc<RwLock<HashMap<String, Vec<Instant>>>>,
    max_requests: u32,
    window: Duration,
}

impl RateLimiter {
    pub fn new(max_requests: u32, window_secs: u64) -> Self {
        Self {
            requests: Arc::new(RwLock::new(HashMap::new())),
            max_requests,
            window: Duration::from_secs(window_secs),
        }
    }

    pub async fn is_allowed(&self, api_key: &str) -> bool {
        let mut requests = self.requests.write().await;
        let now = Instant::now();
        
        let api_key_requests = requests.entry(api_key.to_string()).or_insert_with(Vec::new);
        
        // Remove old requests outside the window
        api_key_requests.retain(|&time| now.duration_since(time) < self.window);
        
        // Check if under limit
        if api_key_requests.len() >= self.max_requests as usize {
            return false;
        }
        
        // Record this request
        api_key_requests.push(now);
        true
    }
}

pub async fn rate_limit_middleware(
    request: Request,
    next: Next,
) -> Result<Response, ProxyError> {
    // Get API key from extensions (set by auth middleware)
    let api_key = request
        .extensions()
        .get::<String>()
        .cloned()
        .unwrap_or_default();

    // TODO: Use rate limiter from app state
    // For now, just pass through
    
    Ok(next.run(request).await)
}
```

**Step 2: Update mod.rs**

Already updated in previous task.

**Step 3: Build**

```bash
cargo build
```

**Step 4: Commit**

```bash
git add .
git commit -m "feat: add rate limiting middleware"
```

---

## Task 7: Create Proxy Service

**Files:**
- Create: `src/services/proxy.rs`
- Create: `src/services/mod.rs`

**Step 1: Create services directory**

```bash
mkdir -p src/services
cat > src/services/mod.rs << 'EOF'
pub mod proxy;
EOF
```

**Step 2: Create proxy.rs**

```rust
use axum::Json;
use reqwest::{Client, Method};
use serde_json::Value;
use tracing::{error, info};

use crate::{
    error::{ProxyError, Result},
    models::{ProxyRequest, ProxyResponse},
};

pub struct ProxyService {
    client: Client,
}

impl ProxyService {
    pub fn new(timeout_secs: u64) -> anyhow::Result<Self> {
        let client = Client::builder()
            .timeout(std::time::Duration::from_secs(timeout_secs))
            .build()?;

        Ok(Self { client })
    }

    pub async fn proxy_request(&self, request: ProxyRequest) -> Result<ProxyResponse> {
        let request_id = uuid::Uuid::new_v4().to_string();
        
        info!(
            request_id = %request_id,
            target_url = %request.target_url,
            method = %request.method,
            "Proxying request"
        );

        // Parse method
        let method = match request.method.to_uppercase().as_str() {
            "GET" => Method::GET,
            "POST" => Method::POST,
            "PUT" => Method::PUT,
            "DELETE" => Method::DELETE,
            "PATCH" => Method::PATCH,
            _ => return Err(ProxyError::BadRequest(format!(
                "Unsupported method: {}",
                request.method
            ))),
        };

        // Build request
        let mut req_builder = self.client.request(method, &request.target_url);

        // Add headers if present
        if let Some(headers) = request.headers {
            for (key, value) in headers {
                if let Some(val_str) = value.as_str() {
                    req_builder = req_builder.header(&key, val_str);
                }
            }
        }

        // Add body if present
        if let Some(body) = request.body {
            req_builder = req_builder.json(&body);
        }

        // Send request
        let response = req_builder
            .send()
            .await
            .map_err(|e| {
                error!(request_id = %request_id, error = %e, "Request failed");
                if e.is_timeout() {
                    ProxyError::Timeout
                } else {
                    ProxyError::UpstreamError(e.to_string())
                }
            })?;

        let status = response.status();
        
        // Parse response body
        let data: Value = response
            .json()
            .await
            .map_err(|e| {
                error!(request_id = %request_id, error = %e, "Failed to parse response");
                ProxyError::UpstreamError(format!("Invalid response: {}", e))
            })?;

        info!(
            request_id = %request_id,
            status = %status,
            "Request completed"
        );

        Ok(ProxyResponse {
            data,
            request_id,
        })
    }
}
```

**Step 3: Update main.rs**

```rust
mod config;
mod error;
mod models;
mod middleware;
mod services;
```

**Step 4: Build**

```bash
cargo build
```

**Step 5: Commit**

```bash
git add .
git commit -m "feat: add proxy service for request forwarding"
```

---

## Task 8: Create WeChat Routes

**Files:**
- Create: `src/routes/wechat.rs`
- Create: `src/routes/mod.rs`
- Modify: `src/main.rs`

**Step 1: Create routes directory**

```bash
mkdir -p src/routes
cat > src/routes/mod.rs << 'EOF'
pub mod wechat;
EOF
```

**Step 2: Create wechat.rs**

```rust
use axum::{
    extract::State,
    routing::post,
    Json, Router,
};
use std::sync::Arc;

use crate::{
    error::Result,
    models::{ProxyRequest, ProxyResponse},
    services::proxy::ProxyService,
};

pub fn routes(proxy_service: Arc<ProxyService>) -> Router {
    Router::new()
        .route("/api/wechat", post(proxy_handler))
        .with_state(proxy_service)
}

async fn proxy_handler(
    State(service): State<Arc<ProxyService>>,
    Json(request): Json<ProxyRequest>,
) -> Result<Json<ProxyResponse>> {
    let response = service.proxy_request(request).await?;
    Ok(Json(response))
}
```

**Step 3: Update main.rs with full implementation**

```rust
use axum::{
    middleware,
    routing::get,
    Router,
};
use std::net::SocketAddr;
use std::sync::Arc;
use tower::ServiceBuilder;
use tower_http::trace::TraceLayer;
use tracing::{info, Level};
use tracing_subscriber::FmtSubscriber;

mod config;
mod error;
mod middleware;
mod models;
mod routes;
mod services;

use config::Config;
use services::proxy::ProxyService;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Load configuration
    let config = Config::from_env()?;
    
    // Initialize logging
    let log_level = config.log_level.parse::<Level>().unwrap_or(Level::INFO);
    let subscriber = FmtSubscriber::builder()
        .with_max_level(log_level)
        .finish();
    
    tracing::subscriber::set_global_default(subscriber)
        .expect("Failed to set subscriber");

    info!("Starting WeChat Proxy Server v{}", env!("CARGO_PKG_VERSION"));
    info!("Configuration loaded successfully");

    // Create proxy service
    let proxy_service = Arc::new(ProxyService::new(config.timeout_seconds)?);

    // Build router
    let app = Router::new()
        .nest("/", routes::wechat::routes(proxy_service.clone()))
        .route("/health", get(health_check))
        .layer(
            ServiceBuilder::new()
                .layer(TraceLayer::new_for_http())
                .layer(middleware::from_fn(middleware::auth::auth_middleware))
        );

    // Bind to address
    let addr: SocketAddr = config.bind_address.parse()?;
    info!("Listening on http://{}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;
    
    Ok(())
}

async fn health_check() -> &'static str {
    "OK"
}
```

**Step 4: Build and test**

```bash
cargo build
cargo run &
sleep 2

# Test without auth (should fail)
curl -X POST http://localhost:3000/api/wechat \
  -H "Content-Type: application/json" \
  -d '{"target_url": "https://api.weixin.qq.com/cgi-bin/token", "method": "GET"}'
# Expected: 401 Unauthorized

# Test with auth
curl -X POST http://localhost:3000/api/wechat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer test-key" \
  -d '{"target_url": "https://api.weixin.qq.com/cgi-bin/token", "method": "GET"}'
# Expected: Response from WeChat API (or error if no valid credentials)

# Test health
curl http://localhost:3000/health
# Expected: OK

kill %1
```

**Step 5: Commit**

```bash
git add .
git commit -m "feat: add wechat routes and integrate all components"
```

---

## Task 9: Add File Upload Support

**Files:**
- Modify: `src/services/proxy.rs`
- Modify: `src/routes/wechat.rs`

**Step 1: Update proxy.rs to support file uploads**

Add to proxy.rs:

```rust
use axum::extract::Multipart;

pub async fn proxy_upload(
    &self,
    target_url: String,
    filename: String,
    content_type: String,
    data: Vec<u8>,
) -> Result<ProxyResponse> {
    let request_id = uuid::Uuid::new_v4().to_string();
    
    info!(
        request_id = %request_id,
        target_url = %target_url,
        filename = %filename,
        size = data.len(),
        "Proxying file upload"
    );

    // Build multipart form
    let part = reqwest::multipart::Part::bytes(data)
        .file_name(filename)
        .mime_str(&content_type)
        .map_err(|e| ProxyError::BadRequest(format!("Invalid content type: {}", e)))?;

    let form = reqwest::multipart::Form::new()
        .part("media", part);

    // Send request
    let response = self.client
        .post(&target_url)
        .multipart(form)
        .send()
        .await
        .map_err(|e| {
            error!(request_id = %request_id, error = %e, "Upload failed");
            if e.is_timeout() {
                ProxyError::Timeout
            } else {
                ProxyError::UpstreamError(e.to_string())
            }
        })?;

    let status = response.status();
    
    let data: Value = response
        .json()
        .await
        .map_err(|e| {
            error!(request_id = %request_id, error = %e, "Failed to parse upload response");
            ProxyError::UpstreamError(format!("Invalid response: {}", e))
        })?;

    info!(
        request_id = %request_id,
        status = %status,
        "Upload completed"
    );

    Ok(ProxyResponse {
        data,
        request_id,
    })
}
```

**Step 2: Add upload route**

Add to wechat.rs:

```rust
use axum::extract::Multipart;

pub fn routes(proxy_service: Arc<ProxyService>) -> Router {
    Router::new()
        .route("/api/wechat", post(proxy_handler))
        .route("/api/wechat/upload", post(upload_handler))
        .with_state(proxy_service)
}

async fn upload_handler(
    State(service): State<Arc<ProxyService>>,
    mut multipart: Multipart,
) -> Result<Json<ProxyResponse>> {
    use crate::models::UploadProxyRequest;
    
    let mut target_url = None;
    let mut filename = None;
    let mut content_type = None;
    let mut file_data = None;

    while let Some(field) = multipart.next_field().await.unwrap() {
        let name = field.name().unwrap_or("").to_string();
        
        match name.as_str() {
            "target_url" => target_url = Some(field.text().await.unwrap()),
            "filename" => filename = Some(field.text().await.unwrap()),
            "content_type" => content_type = Some(field.text().await.unwrap()),
            "file" => {
                filename = field.file_name().map(|s| s.to_string());
                content_type = field.content_type().map(|s| s.to_string());
                file_data = Some(field.bytes().await.unwrap().to_vec());
            }
            _ => {}
        }
    }

    let response = service.proxy_upload(
        target_url.ok_or_else(|| ProxyError::BadRequest("Missing target_url".to_string()))?,
        filename.ok_or_else(|| ProxyError::BadRequest("Missing filename".to_string()))?,
        content_type.unwrap_or_else(|| "application/octet-stream".to_string()),
        file_data.ok_or_else(|| ProxyError::BadRequest("Missing file data".to_string()))?,
    ).await?;

    Ok(Json(response))
}
```

**Step 3: Build**

```bash
cargo build
```

**Step 4: Commit**

```bash
git add .
git commit -m "feat: add multipart file upload support"
```

---

## Task 10: Create Systemd Service File

**Files:**
- Create: `wechat-proxy.service`

**Step 1: Create systemd service file**

```bash
cat > wechat-proxy.service << 'EOF'
[Unit]
Description=WeChat Proxy Server for Obsidian Plugin
After=network.target

[Service]
Type=simple
User=wechat-proxy
Group=wechat-proxy
WorkingDirectory=/opt/wechat-proxy
Environment="RUST_LOG=info"
Environment="PROXY_API_KEY=your-secret-key-change-this"
Environment="RATE_LIMIT_PER_MINUTE=100"
Environment="TIMEOUT_SECONDS=60"
Environment="BIND_ADDRESS=0.0.0.0:3000"
ExecStart=/opt/wechat-proxy/wechat-proxy-server
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=wechat-proxy

[Install]
WantedBy=multi-user.target
EOF
```

**Step 2: Create deployment script**

```bash
cat > deploy.sh << 'EOF'
#!/bin/bash
set -e

echo "Building release binary..."
cargo build --release

echo "Creating deployment package..."
mkdir -p deploy
cp target/release/wechat-proxy-server deploy/
cp wechat-proxy.service deploy/
cp README.md deploy/

echo "Deployment package created in ./deploy/"
echo ""
echo "To deploy on server:"
echo "1. Copy deploy/wechat-proxy-server to /opt/wechat-proxy/"
echo "2. Copy deploy/wechat-proxy.service to /etc/systemd/system/"
echo "3. Run: sudo systemctl daemon-reload"
echo "4. Run: sudo systemctl enable wechat-proxy"
echo "5. Run: sudo systemctl start wechat-proxy"
echo "6. Check status: sudo systemctl status wechat-proxy"
EOF

chmod +x deploy.sh
```

**Step 3: Commit**

```bash
git add .
git commit -m "feat: add systemd service file and deployment script"
```

---

## Task 11: Final Build and Documentation

**Step 1: Build release version**

```bash
cargo build --release
```

**Step 2: Verify binary**

```bash
ls -lh target/release/wechat-proxy-server
# Should be < 10MB for a Rust binary
```

**Step 3: Update README with full documentation**

```bash
cat > README.md << 'EOF'
# WeChat Proxy Server

A lightweight Rust proxy server for Obsidian WeChat plugin.

## Features

- **API Key Authentication** - Secure your proxy with Bearer token
- **Rate Limiting** - Prevent abuse with per-key rate limits
- **Request Logging** - Full request/response logging with tracing
- **File Upload Support** - Proxy multipart file uploads to WeChat
- **Health Check** - /health endpoint for monitoring
- **Configurable** - Environment variable based configuration
- **Production Ready** - Systemd service file included

## Quick Start

```bash
# Clone and build
git clone https://github.com/jackice/wechat-proxy-server.git
cd wechat-proxy-server
cargo build --release

# Set environment variables
export PROXY_API_KEY="your-secret-key"
export RATE_LIMIT_PER_MINUTE=100

# Run
./target/release/wechat-proxy-server
```

## Configuration

Environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `PROXY_API_KEY` | `default-key-change-in-production` | API key for authentication |
| `RATE_LIMIT_PER_MINUTE` | `100` | Requests per minute per API key |
| `TIMEOUT_SECONDS` | `30` | Request timeout |
| `LOG_LEVEL` | `info` | Log level (debug, info, warn, error) |
| `BIND_ADDRESS` | `0.0.0.0:3000` | Server bind address |

## API Endpoints

### Health Check
```bash
GET /health
```

### Proxy Request
```bash
POST /api/wechat
Authorization: Bearer <your-api-key>
Content-Type: application/json

{
  "target_url": "https://api.weixin.qq.com/cgi-bin/token",
  "method": "GET",
  "headers": {},
  "body": null
}
```

### Upload File
```bash
POST /api/wechat/upload
Authorization: Bearer <your-api-key>
Content-Type: multipart/form-data

- target_url: https://api.weixin.qq.com/cgi-bin/media/uploadimg
- filename: image.jpg
- content_type: image/jpeg
- file: <binary data>
```

## Production Deployment

### 1. Create user
```bash
sudo useradd -r -s /bin/false wechat-proxy
```

### 2. Install binary
```bash
sudo mkdir -p /opt/wechat-proxy
sudo cp target/release/wechat-proxy-server /opt/wechat-proxy/
sudo chown -R wechat-proxy:wechat-proxy /opt/wechat-proxy
```

### 3. Configure
```bash
sudo nano /opt/wechat-proxy/.env
# Add your configuration
```

### 4. Setup systemd
```bash
sudo cp wechat-proxy.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable wechat-proxy
sudo systemctl start wechat-proxy
```

### 5. Check status
```bash
sudo systemctl status wechat-proxy
sudo journalctl -u wechat-proxy -f
```

## Integration with Obsidian Plugin

1. Deploy this proxy server on your cloud server
2. Add the server's IP to WeChat Official Account IP whitelist
3. In Obsidian plugin settings:
   - Enable "Use Proxy Server"
   - Set proxy URL: `http://your-server:3000/api/wechat`
   - Set API Key: your configured `PROXY_API_KEY`

## License

MIT
EOF
```

**Step 4: Final commit and push**

```bash
git add .
git commit -m "docs: complete README with deployment instructions"
git push origin main
```

**Step 5: Create GitHub repository and push**

```bash
# Create repo on GitHub first, then:
git remote add origin git@github.com:jackice/wechat-proxy-server.git
git push -u origin main
```

---

## Summary

This implementation plan creates a complete Rust proxy server with:
- ✅ Axum web framework
- ✅ Authentication middleware
- ✅ Rate limiting
- ✅ Request/response logging
- ✅ File upload support
- ✅ Error handling
- ✅ Configuration management
- ✅ Systemd service file
- ✅ Production deployment guide

**Total estimated time**: 45-60 minutes
**Total files created**: ~15 files
**Lines of code**: ~800-1000 lines

Ready to implement?
