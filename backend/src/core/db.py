from litestar.plugins.sqlalchemy import SQLAlchemyAsyncConfig, SQLAlchemyPlugin
from sqlalchemy.orm import DeclarativeBase
from src.core.config import settings


class Base(DeclarativeBase):
    pass


db_config = SQLAlchemyAsyncConfig(
    connection_string=settings.DATABASE_URL,
    metadata=Base.metadata,
    # El esquema lo maneja Alembic: `alembic upgrade head`
    create_all=False,
)
db_plugin = SQLAlchemyPlugin(config=db_config)