FROM python:3.12-slim

WORKDIR /app

# Instalamos uv
RUN pip install --no-cache-dir uv

# Variables de entorno para uv y Python
ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    PYTHONUNBUFFERED=1

# Copiamos solo los manifiestos primero para aprovechar la cache de Docker:
# si no cambian las dependencias, no se reinstalan en cada build
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-install-project --no-dev

# Ahora sí copiamos el código de la app
COPY . .

# Instalamos el propio proyecto (por si tiene entry points o se importa como paquete)
RUN uv sync --frozen --no-dev

# El venv de uv queda en /app/.venv — lo ponemos al frente del PATH
ENV PATH="/app/.venv/bin:$PATH"

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]