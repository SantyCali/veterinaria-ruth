# Sistema integral de gestión veterinaria

## 1. Objetivo general

Desarrollar una aplicación integral para administrar una clínica veterinaria. El sistema debe permitir gestionar clientes, mascotas, historias clínicas de mascotas, turnos, agenda diaria, tratamientos, estudios y toda la información necesaria para el funcionamiento cotidiano de una veterinaria.

La aplicación debe ser intuitiva, facil de utilizar, organizada y permitir acceder rápidamente a la información de cada cliente y sus mascotas.

## 2. Gestión de usuarios y acceso

El sistema debe contar con un acceso mediante inicio de sesión (Gmail + contraseña).

Cada usuario debe tener sus propias credenciales.

Debe existir un perfil de usuario donde pueda consultar y modificar sus datos personales.

Debe contemplarse la posibilidad de administrar diferentes roles de usuarios, como administrador y veterinario, con distintos permisos de acceso.

## 3. Gestión de clientes

El sistema debe permitir registrar, consultar, editar y desactivar clientes.

Los datos principales de un cliente son:

Nombre.

Apellido.

Correo electrónico.

Teléfono.

Dirección.

Un cliente puede tener asociadas múltiples mascotas.

Un cliente puede desactivarse mediante una baja lógica, sin eliminar sus datos ni los registros históricos relacionados.

También debe ser posible volver a activar un cliente previamente desactivado.

## 4. Gestión de mascotas

El sistema debe permitir registrar, consultar, editar, activar y desactivar mascotas.

Los datos principales de una mascota son:

Nombre.

Especie.

Raza.

Fecha de nacimiento.

Sexo.

Esterilizado (Si o no).

Cliente o dueño asociado (Si es que tiene).

Una mascota puede tener un dueño o no tener ninguno. Esto último es importante porque pueden existir animales rescatados, en adopción o pertenecientes a la propia veterinaria.

Un cliente puede tener muchas mascotas, pero una mascota solamente puede tener un cliente asignado a la vez.

Debe existir un estado para identificar si la mascota está activa, inactiva o fallecida.

Es fundamental que dar de baja o marcar como fallecida a una mascota no implique eliminar su información ni su historial clinico.

Aunque una mascota haya fallecido, su ficha médica, historial clínico, tratamientos, diagnósticos y estudios deben permanecer disponibles para futuras consultas. Esta información histórica puede resultar útil para diagnosticar y tratar otras mascotas. Se deben poder subir estudios relacionados a la mascota en formato PDF, excel o imagenes.

También debe poder cambiarse el dueño de una mascota sin perder su historial clínico.

## 5. Historia clínica y ficha médica

Cada mascota debe contar con una ficha médica individual.

La ficha debe permitir registrar y consultar:

Fecha de cada consulta.

Motivo de consulta.

Síntomas. (campo opcional)

Diagnóstico. (campo opcional)

Tratamiento indicado. (campo opcional)

Medicamentos recetados. (campo opcional)

Observaciones del veterinario. (campo opcional)

Estudios realizados. (campo opcional)

Resultados de estudios. (campo opcional)

Evolución del paciente. (campo opcional)

Una mascota puede tener múltiples consultas y registros médicos a lo largo de su vida.

El historial clínico debe ser cronológico y conservar todos los registros anteriores.

No se deben eliminar los antecedentes médicos cuando se modifica información de la mascota, cuando cambia de dueño o cuando se marca como fallecida.

Debe ser posible consultar el historial completo de una mascota desde su perfil.

## 6. Gestión de turnos y calendario

El sistema debe contar con un calendario para administrar los turnos veterinarios.

Debe permitir:

Crear nuevos turnos.

Asignar un turno a un cliente y a su mascota.

Seleccionar fecha y horario.

Registrar el motivo de la consulta.

Modificar turnos existentes.

Cancelar turnos.

Marcar turnos como atendidos.

Identificar turnos pendientes.

Consultar turnos anteriores.

El calendario debe permitir visualizar los turnos de manera diaria, semanal y mensual.

Los turnos deben conservar su información histórica, incluso si posteriormente se cancela un turno o se desactiva una mascota o un cliente.

## 7. Agenda diaria y tareas

La aplicación debe contar con una agenda diaria para organizar las actividades de la veterinaria.

Debe permitir:

Anotar tareas pendientes.

Registrar recordatorios.

Crear actividades para determinados días y horarios.

Marcar tareas como completadas.

Consultar tareas pendientes y vencidas.

Registrar notas importantes del día.

La agenda debe funcionar como un organizador de las actividades cotidianas, independientemente de los turnos médicos.

## 8. Gestión de tratamientos y medicamentos

El sistema debe permitir registrar los tratamientos indicados a cada mascota.

Debe contemplar:

Nombre del medicamento o tratamiento.

Dosis.

Frecuencia de administración.

Duración.

Fecha de inicio.

Fecha de finalización.

Indicaciones adicionales.

Los tratamientos deben quedar asociados a la historia clínica correspondiente.

También debe poder consultarse qué tratamientos recibió una mascota anteriormente.

## 9. Estudios y archivos médicos

El sistema debe permitir adjuntar y consultar archivos relacionados con cada mascota.

Por ejemplo:

Radiografías.

Ecografías.

Análisis de sangre.

Análisis de laboratorio.

Fotografías.

Otros estudios complementarios.

Cada archivo debe quedar asociado a la mascota y, cuando corresponda, a una consulta o ficha médica específica.

Los estudios deben conservarse como parte del historial clínico y seguir disponibles aunque la mascota haya fallecido o cambiado de dueño.

## 10. Consultas y búsquedas

Debe existir una forma sencilla de buscar información dentro del sistema.

Por ejemplo:

Buscar clientes por nombre, apellido o correo electrónico.

Buscar mascotas por nombre, especie o raza.

Consultar todas las mascotas de un cliente.

Buscar mascotas sin dueño.

Consultar mascotas fallecidas.

Buscar turnos por fecha.

Consultar historiales clínicos.

## 11. Estados y bajas lógicas

Las entidades principales deben conservar su información histórica.

Las bajas deben ser lógicas y no físicas.

Esto significa que:

Desactivar un cliente no elimina sus mascotas ni sus antecedentes.

Desactivar una mascota no elimina su ficha médica.

Marcar una mascota como fallecida no elimina sus consultas, tratamientos ni estudios.

Cancelar un turno no elimina su registro histórico.

Debe ser posible distinguir claramente los registros activos de los inactivos y los históricos.

## 12. Panel principal

Al ingresar a la aplicación, el usuario debería encontrar un panel principal con información relevante para el funcionamiento diario de la veterinaria.

Por ejemplo:

Cantidad de turnos del día.

Próximos turnos.

Tareas pendientes.

Recordatorios. (Los recordatorios podrian enviar una notificacion al whatsapp o algo asi del medico veterinario).

Últimas consultas registradas.

Accesos rápidos para registrar clientes, mascotas y turnos.

El objetivo es que el panel principal permita tener una visión general de la actividad de la veterinaria sin tener que ingresar a cada módulo individualmente.

## 13. Consideraciones generales

La información debe estar organizada y relacionada correctamente.

Las relaciones entre clientes, mascotas, turnos e historias clínicas deben conservar su integridad.

No se deben perder antecedentes históricos por modificaciones administrativas.

La aplicación debe ser fácil de utilizar y tener una interfaz clara y profesional.

Se debe priorizar la rapidez para realizar las tareas habituales de una veterinaria.

Los distintos módulos deben estar relacionados entre sí para evitar duplicar información.

Inventario y stock seran tareas para desarrollo futuro.