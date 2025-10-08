import os


class Settings:
    APP_NAME = "Teacher Assessment API"
    APP_VERSION = "1.0.0"

    # MongoDB Atlas URI (from user)
    MONGODB_URI = os.getenv(
        "MONGODB_URI",
        "mongodb+srv://aiproject:px2e0JPBGFtFJX96@cluster0.vhuq7hn.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0",
    )
    MONGO_DB_NAME = os.getenv("MONGO_DB_NAME", "teacher_assessment")

    # Auth/JWT
    JWT_SECRET = os.getenv("JWT_SECRET", "change-this-secret")
    JWT_ALGORITHM = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))
    REFRESH_TOKEN_EXPIRE_DAYS = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", "7"))

    # Uploads
    UPLOAD_DIR = os.getenv("UPLOAD_DIR", os.path.join(os.getcwd(), "backend", "uploads"))

    # Rate limiting
    RATE_LIMIT_PER_MINUTE = int(os.getenv("RATE_LIMIT_PER_MINUTE", "120"))


settings = Settings()



