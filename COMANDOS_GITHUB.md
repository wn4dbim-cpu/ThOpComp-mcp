# Comandos para subir a GitHub

## Paso 1: Navegar a la carpeta del proyecto
```powershell
cd "C:\Users\M3500\Documents\ThOpComp-mcp"
```

## Paso 2: Inicializar Git (si no está inicializado)
```powershell
git init
```

## Paso 3: Verificar que el .gitignore esté correcto
Asegúrate de que el .gitignore ignore:
- node_modules/
- dist/
- .env
- etc.

## Paso 4: Agregar todos los archivos
```powershell
git add .
```

## Paso 5: Hacer el primer commit
```powershell
git commit -m "Initial commit: ThOpComp-mcp project"
```

## Paso 6: Agregar el repositorio remoto
```powershell
git remote add origin https://github.com/TU_USUARIO/ThOpComp-mcp.git
```
(Reemplaza TU_USUARIO con tu nombre de usuario de GitHub)

## Paso 7: Renombrar la rama principal a 'main' (si es necesario)
```powershell
git branch -M main
```

## Paso 8: Subir los archivos a GitHub
```powershell
git push -u origin main
```

## Si te pide autenticación:
- Si usas HTTPS, GitHub te pedirá usuario y contraseña
- Para contraseña, usa un Personal Access Token (no tu contraseña de GitHub)
- Para crear un token: GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic) → Generate new token

## Si ya tienes el repositorio inicializado y solo quieres cambiar el remoto:
```powershell
git remote remove origin
git remote add origin https://github.com/TU_USUARIO/ThOpComp-mcp.git
git push -u origin main
```

