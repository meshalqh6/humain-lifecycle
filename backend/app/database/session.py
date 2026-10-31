from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.config import settings

engine = create_engine(
    settings().database_url.get_secret_value(), pool_pre_ping=True, pool_size=5, max_overflow=5, hide_parameters=True
)
Session = sessionmaker(engine, expire_on_commit=False)


def db_session():
    with Session() as session:
        yield session
