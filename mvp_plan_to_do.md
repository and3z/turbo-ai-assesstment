# Plan de Construcción del MVP: Plataforma de Automatización de Pedidos

Este documento detalla el plan paso a paso, dividido por fases, para construir
el MVP descrito en el Product Requirements Document (`prd-platform.md`) y el
One-Pager (`one-page.md`), integrando fuertemente los requerimientos con los
diseños de interfaz disponibles.

---

## Fase 1: Configuración del Entorno y Arquitectura Base

**Objetivo:** Establecer los cimientos técnicos del proyecto.

- [x] **Inicialización del Proyecto:** Crear la aplicación base utilizando
      **Next.js (React)** y configurarla para soportar un entorno Progressive
      Web App (PWA).
- [x] **Estructura de Datos Mockeada:** Como se trata de un prototipo, no se
      usará base de datos real. El estado de la aplicación vivirá en memoria (o
      LocalStorage) con Mock Data inicial. El modelo `Order` mantendrá el
      identificador secuencial legible (ej. `ORD-00001`), información separada
      en campos para el paciente (`First Name`, `Last Name`), dirección,
      producto/proveedor, cálculos y estados.
- [x] **Configuración de UI:** Instalar y configurar un sistema de diseño (ej.
      Tailwind CSS o similar) que garantice el escalado de los estilos visuales
      estipulados en las pantallas de diseño.
- [ ] **Pipeline de Despliegue:** Configurar el entorno y las variables
      necesarias en **Vercel** para lanzamientos rápidos.

## Fase 2: Autenticación Global (User Story 1 - US1)

**Objetivo:** Proteger los datos sensibles financieros y de los pacientes en un
entorno restringido.

- [x] **Pantalla de Login:** Desarrollar la interfaz `global_login_screen`
      visualizada en `assets/screens/global_login_screen`.
- [x] **Lógica de Autenticación:** Incorporar un flujo básico de sesión ('shared
      passcode' hardcodeado como `12345` al tratarse de un prototipo) para
      proteger el acceso exclusivo del staff interno.
- [x] **Protección de Rutas:** Parametrizar las vistas privadas en Next.js para
      asegurar que ninguna entidad sin credenciales acceda a los datos.

## Fase 3: Dashboard Central e Indicadores de Estado (US4)

**Objetivo:** Visualización holística y gestión interactiva del estado de los
pedidos.

- [x] **Tabla de Datos (Dashboard):** Construir la vista principal para la lista
      de órdenes integrando las perspectivas operativas y financieras:
  - Vista Operativa: Replicar el diseño
    `order_directory_dashboard-(Operations)`.
  - Vista Financiera: Replicar el diseño paralelo
    `order_directory_dashboard-(financials)`.
- [x] **Gestión Rápida de Estados:** Incorporar toggles y dropdowns iteractivos
      dentro de la tabla para mutar directamente los campos:
  - `Payment`: `Waiting` | `Paid`
  - `Vendor`: `Waiting` | `Sent`
- [x] **Regla de Negocio "Vendor Lock" (Regla 1):** Configurar y programar un
      bloqueo en el frontend (con validación de seguridad secundaria en el
      backend). Impedir que la interfaz o las peticiones cambien el
      `vendor_state` a `Sent` si el `payment_state` sigue estando en `Waiting`.

## Fase 4: Creación y Edición Manual de Pedidos (US3)

**Objetivo:** Permitir el ingreso o corrección de datos para casos excepcionales
o puntuales.

- [x] **Modal de Creación y Detalles:** Implementar la UX/UI a partir de
      `order_detail_edit_modal` posibilitando ver y editar la información de un
      registro `Order`.
- [x] **Gestión de Formularios:** Habilitar controles para información del
      paciente (campos explícitamente separados para `First Name` y
      `Last Name`), dirección de envío, email del proveedor e información de
      costos/márgenes. Los datos pueden dejarse incompletos y ser salvados para
      ser rellenados más tarde.
- [x] **Integración de APIs:** Escribir los endpoints HTTP para realizar las
      inserciones o actualizaciones de estos datos en base de datos.

## Fase 5: El "Puente" - Importación Masiva mediante CSV (US2)

**Objetivo:** Otorgar una vía rápida para poblar el sistema mitigando el
redigitado para el equipo que actualmente usa Excel.

- [x] **Modal de Subida:** Implementar el pop-up de carga de archivos
      `bulk_csv_import_modal`.
- [x] **Procesamiento de Archivos:** Programar una función que parsee los
      archivos `.csv` bajo una plantilla modelo.
- [x] **Ingesta y Mapeo:** Mapear cada columna del CSV al modelo Mock en
      memoria/LocalStorage. Se permitirá guardar registros incompletos; los
      campos obligatorios pendientes se podrán gestionar manualmente después.

## Fase 6: Enrutamiento Automatizado hacia Proveedores (US5)

**Objetivo:** Centralizar el disparador de notificaciones y automatizar los
pedidos a los correos e integraciones logísticas.

- [x] **Modal de Confirmación de Envío:** Configurar el flujo que previene
      envíos accidentales desarrollando la pantalla emergente en
      `send-to-vendor-confirmation`.
- [x] **Lógica "Webhook Trigger" (Regla 2):** Generar una función de lado del
      Backend (Serverless Function en Next.js) que "escuche" cuando una variable
      de estado de la Orden (en Fase 3/4) consolide su paso exitoso a `Sent`.
- [x] **Integración vía Payload hacia Make.com:**
  - Analizar la orden, si hay campos clave incompletos exigibles por el vendor,
    mostrar un mensaje de alerta indicando que hay valores incompletos.
  - Enviar una petición POST asíncrona a la URL de Make.com ya existente al
    detectar que la orden está completa y autorizada para envío.
  - Asegurar, por motivos de seguridad (_Security Note_ del PRD), que el Payload
    JSON **EXCLUYA CUALQUIER** propiedad financiera calculada (como ingresos o
    margen). Sólo suministrar Id, Datos del Paciente, detalles específicos para
    el correo y marca temporal (`timestamp`).

## Fase 7: Pruebas, Shadowing y Preparación para Siguientes Hitos (Lean Construction)

**Objetivo:** Validar la reducción en el volumen de trabajo y tiempo de
respuesta sin riesgo operativo para la clientela existente.

- [ ] **Testing de Calidad (QA):** Chequeo exhaustivo para validar la
      restricción del "Vendor Lock" y el formato preciso de salida para
      Make.com.
- [ ] **Evaluación "Shadowing" con el Staff:** Establecer la primera semana
      paralela. El Staff continuará su esquema habitual en Excel, y como rutina,
      subirá el CSV resultante en la aplicación al final del día.
- [ ] **Mocking de Vendedores y Webhooks:** Revisar en Make.com que todos los
      webhooks lanzados se correspondan idóneamente con el requerimiento del
      proveedor real sin filtrar cálculos internos.
- [ ] **Analíticas de Usabilidad:** Analizar fricciones en el abordaje general
      (_adoption and friction_ según el One-Pager) antes de abordar la
      arquitectura de los próximos 'Milestones' de cálculos nativos o gestión de
      archivos (Fuera del Scope del MVP).
