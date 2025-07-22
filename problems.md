🚨 PROBLEMAS CRÍTICOS IDENTIFICADOS

1. PROBLEMA PRINCIPAL: La herramienta playAudio NO está disponible para la IA
   Ubicación: app/(chat)/api/chat/route.ts líneas 230-273
   Problema: En la configuración de herramientas para el evaluador TEA, solo están disponibles:
   Apply
   ,
   La herramienta playAudioTool NO está incluida, pero el prompt del examen dice que es OBLIGATORIO usarla.
2. Descoordinación entre reproducción de audio y evaluación
   Ubicación: lib/ai/tools/play-audio.ts línea 117
   Apply
   ;
   Problema: La herramienta selecciona archivos aleatoriamente, pero la IA necesita saber exactamente qué grabación específica se reprodujo para acceder al transcript y respuestas correctas correspondientes.
3. Falta de coordinación entre grabaciones y datos de evaluación
   Problema: La IA no tiene forma de:
   Saber qué grabación específica (1-6 para 2A, 1-4 para 2B, etc.) está reproduciendo
   Acceder al transcript correspondiente para esa grabación específica
   Comparar respuestas del usuario con las respuestas correctas
4. URLs inconsistentes en el sistema de audio
   Ubicación: lib/ai/tools/play-audio.ts líneas 121-140
   Problema: El sistema genera URLs de dos formas diferentes:
   Para exámenes: /api/audio?exam=tea&section=2a&recording=1
   Para archivos generales: /api/audio?file=${audioFile}
   Pero siempre usa recording=1, no permite especificar diferentes grabaciones.
