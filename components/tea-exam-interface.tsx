'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { TeaTimer, type TeaSection } from './tea-timer';
import { TeaSectionControls } from './tea-section-controls';
import { Chat } from './chat';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { AlertTriangle, FileText } from 'lucide-react';
import type { Session } from 'next-auth';
import type { UIMessage } from 'ai';
import { DataStreamHandler } from './data-stream-handler';
import { TeaHistory } from './tea-history';

interface TeaExamInterfaceProps {
  chatId: string;
  initialMessages: UIMessage[];
  session: Session;
}

export function TeaExamInterface({
  chatId,
  initialMessages,
  session,
}: TeaExamInterfaceProps) {
  // Estado del examen
  const [examStarted, setExamStarted] = useState(false);
  const [currentSection, setCurrentSection] = useState<TeaSection>(1);
  const [completedSections, setCompletedSections] = useState<TeaSection[]>([]);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [examCompleted, setExamCompleted] = useState(false);
  const [showInstructions, setShowInstructions] = useState(true);

  // Mensajes del chat con instrucciones iniciales
  const [messages, setMessages] = useState<UIMessage[]>(() => {
    if (initialMessages.length === 0) {
      return [
        {
          id: 'tea-welcome',
          role: 'assistant',
          content: '',
          parts: [
            {
              type: 'text',
              text: `¡Bienvenido al simulador del Test de Inglés Aeronáutico (TEA)!

Soy su evaluador certificado ICAO. Este examen evalúa su competencia lingüística en inglés para operaciones aeronáuticas.

**INFORMACIÓN DEL EXAMEN:**
- ⏱️ Duración: 25-30 minutos
- 📋 3 secciones obligatorias
- 🎯 Nivel mínimo requerido: ICAO Nivel 4 (Operacional)

**INSTRUCCIONES:**
1. Use el panel de control para iniciar el examen
2. Complete cada sección en orden
3. El timer controla la duración de cada sección
4. Responda de manera natural y completa

¿Está listo para comenzar? Haga clic en "Iniciar Examen TEA" cuando esté preparado.`,
            },
          ],
          createdAt: new Date(),
          experimental_attachments: [],
        },
      ];
    }
    return initialMessages;
  });

  // Handlers del examen
  const handleStartExam = () => {
    setExamStarted(true);
    setShowInstructions(false);
    setIsTimerRunning(true);

    // Enviar mensaje de inicio de sección 1
    const sectionStartMessage: UIMessage = {
      id: `tea-section-${currentSection}-start`,
      role: 'assistant',
      content: '',
      parts: [
        {
          type: 'text',
          text: `**SECCIÓN 1: ENTREVISTA Y EXPERIENCIA** (7-8 minutos)

Comenzemos con algunas preguntas sobre su experiencia profesional en aviación.

1. **¿Cuál es su rol actual en la aviación?**
   - ¿Es usted piloto, controlador de tráfico aéreo, técnico u otro profesional?
   - ¿Cuántos años de experiencia tiene en este rol?

Por favor, responda de manera detallada y natural.`,
        },
      ],
      createdAt: new Date(),
      experimental_attachments: [],
    };

    setMessages((prev) => [...prev, sectionStartMessage]);
    toast.success('Examen TEA iniciado - Sección 1');
  };

  const handleSectionChange = (section: TeaSection) => {
    if (isTimerRunning) {
      toast.warning('Pause el timer antes de cambiar de sección');
      return;
    }

    setCurrentSection(section);

    // Enviar mensaje de cambio de sección
    const sectionMessages = {
      1: `**SECCIÓN 1: ENTREVISTA Y EXPERIENCIA** (7-8 minutos)

Preguntas sobre su rol profesional y experiencia en aviación. Responda de manera natural y detallada.`,
      2: `**SECCIÓN 2: COMPRENSIÓN INTERACTIVA** (8-12 minutos)

Ahora evaluaré su comprensión auditiva. Le presentaré situaciones aeronáuticas que debe interpretar y explicar.`,
      3: `**SECCIÓN 3: DESCRIPCIÓN Y DISCUSIÓN** (10 minutos)

Finalmente, describirá imágenes relacionadas con aviación y participará en una discusión general sobre temas aeronáuticos.`,
    };

    const sectionMessage: UIMessage = {
      id: `tea-section-${section}-change`,
      role: 'assistant',
      content: '',
      parts: [
        {
          type: 'text',
          text: sectionMessages[section],
        },
      ],
      createdAt: new Date(),
      experimental_attachments: [],
    };

    setMessages((prev) => [...prev, sectionMessage]);
    toast.info(`Cambiado a Sección ${section}`);
  };

  const handleSectionComplete = (section: TeaSection) => {
    if (!completedSections.includes(section)) {
      setCompletedSections((prev) => [...prev, section]);
      toast.success(`Sección ${section} completada`);

      // Auto-avance a la siguiente sección si existe
      if (section < 3) {
        setTimeout(() => {
          handleSectionChange((section + 1) as TeaSection);
        }, 2000);
      }
    }
  };

  const handleTimerWarning = (section: TeaSection, timeLeft: number) => {
    toast.warning(`Sección ${section}: Quedan 2 minutos`, {
      icon: <AlertTriangle className="size-4" />,
    });
  };

  const handleToggleTimer = () => {
    setIsTimerRunning(!isTimerRunning);
    toast.info(isTimerRunning ? 'Timer pausado' : 'Timer reanudado');
  };

  const handleResetTimer = (section: TeaSection) => {
    toast.info(`Timer de Sección ${section} reiniciado`);
  };

  const handleEndExam = () => {
    setExamCompleted(true);
    setIsTimerRunning(false);

    const finalMessage: UIMessage = {
      id: 'tea-exam-complete',
      role: 'assistant',
      content: '',
      parts: [
        {
          type: 'text',
          text: `**🎉 EXAMEN TEA COMPLETADO**

Felicitaciones, ha completado las 3 secciones del Test de Inglés Aeronáutico.

**RESUMEN DEL EXAMEN:**
- ✅ Sección 1: Entrevista y Experiencia
- ✅ Sección 2: Comprensión Interactiva  
- ✅ Sección 3: Descripción y Discusión

Ahora procederé a evaluar su desempeño según los criterios ICAO y le proporcionaré su puntuación final con recomendaciones específicas.

**Criterios de Evaluación ICAO:**
1. Pronunciación
2. Estructura Gramatical
3. Vocabulario
4. Fluidez
5. Comprensión
6. Interacciones

¿Desea recibir su evaluación final ahora?`,
        },
      ],
      createdAt: new Date(),
      experimental_attachments: [],
    };

    setMessages((prev) => [...prev, finalMessage]);
    toast.success('¡Examen completado exitosamente!');
  };

  return (
    <div className="flex">
      {/* Área de Chat Principal */}
      <div className="flex-1 flex flex-col">
        <Chat
          key={chatId}
          id={chatId}
          initialMessages={messages}
          initialChatModel="tea-evaluator"
          initialVisibilityType="private"
          autoResume={false}
          isReadonly={false}
          session={session}
          hideControls={true}
        />
        <DataStreamHandler id={chatId} />
      </div>

      {/* TEA History Sidebar */}
      <div className="flex flex-col min-w-0 h-dvh bg-sidebar">
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* TEA History */}
          <TeaHistory user={session.user} />
          {examStarted && (
            <TeaTimer
              currentSection={currentSection}
              onSectionComplete={handleSectionComplete}
              onTimerWarning={handleTimerWarning}
              isRunning={isTimerRunning}
              onToggleTimer={handleToggleTimer}
              onResetTimer={handleResetTimer}
            />
          )}

          <TeaSectionControls
            currentSection={currentSection}
            completedSections={completedSections}
            onSectionChange={handleSectionChange}
            onStartExam={handleStartExam}
            onEndExam={handleEndExam}
            examStarted={examStarted}
            isTimerRunning={isTimerRunning}
          />

          {showInstructions && (
            <Card className="bg-sidebar">
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <FileText className="size-4" />
                  Instrucciones Rápidas
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs space-y-2">
                <p>• Responda de manera natural y completa</p>
                <p>• Use vocabulario técnico cuando sea apropiado</p>
                <p>• No se preocupe por errores menores</p>
                <p>• El evaluador le hará preguntas de seguimiento</p>
                <p>• Mantenga una conversación fluida</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
