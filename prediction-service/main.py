from fastapi import FastAPI
from config import settings

# Crear instancia de la aplicación FastAPI
app = FastAPI(
    title="Prediction Service API",
    description="API para servicios de predicción y análisis prescriptivo",
    version="1.0.0"
)

# Ruta de prueba (Health Check)
@app.get("/")
def read_root():
    """
    Endpoint de prueba para verificar que el servicio esté funcionando.
    """
    return {"message": "Prediction Service is running", "service": "prediction-service"}

# Ruta para una solicitud de predicción simulada
@app.post("/predict")
def predict(data: dict):
    """
    Endpoint para realizar predicciones.
    Recibe datos en formato JSON y devuelve una predicción simulada.
    """
    # Aquí iría la lógica de machine learning real. Esta respuesta es temporal.
    
    # Simular una predicción
    result = {
        "input_data": data,
        "prediction": "95% probabilidad de éxito",
        "confidence": 0.95,
        "model_used": "modelo_prescriptivo_v2"
    }
    
    return result

# Ejecutar el servidor con uvicorn
if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app" if settings.reload else app,
        host=settings.host,
        port=settings.port,
        log_level=settings.log_level,
        reload=settings.reload,
    )
