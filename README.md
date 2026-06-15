# Generador de Caracteristicas

Pagina para buscar celulares, rellenar caracteristicas automaticamente y descargar una ficha horizontal en PNG o JPG.

## Uso local

1. Haz doble clic en `INICIAR.bat`.
2. Abre `http://localhost:8000`.
3. Inicia sesion.
4. Busca el celular, corrige datos si hace falta y descarga PNG/JPG.

## Funciones principales

- `Crear plantilla`: busca equipos, genera la ficha y permite descargarla.
- `Guardar en biblioteca`: almacena la imagen generada en `galeria/<marca>`.
- `Biblioteca`: muestra las imagenes guardadas, separadas por marca.

## Usarlo como app

Opcion rapida en Windows:

1. Haz doble clic en `INICIAR_APP.bat`.
2. Se abrira en una ventana tipo app de Chrome.

Opcion instalable:

1. Abre `http://localhost:8000` en Chrome.
2. En el menu de Chrome elige `Guardar y compartir` o `Instalar pagina como app`.
3. Windows creara un acceso directo tipo app usando Chrome.

## Usuarios para publicacion

El login real se valida en `server.js`, no en el navegador. Para cambiar usuarios en un hosting, configura la variable:

`APP_USERS=usuario1:clave1,usuario2:clave2`

Ejemplo:

`APP_USERS=ventas@empresa.com:ClaveSegura2026,admin@empresa.com:OtraClave`

## Publicar en Render

1. Sube esta carpeta a GitHub.
2. Crea un Web Service en Render.
3. Root directory: `frontend`
4. Build command: dejar vacio.
5. Start command: `npm start`
6. Agrega la variable `APP_USERS`.

El servidor usa el puerto que entregue el hosting con `PORT`.
