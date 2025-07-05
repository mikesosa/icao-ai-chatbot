'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import {
  // ExamTimer,
  type ExamSection,
  type ExamConfig,
  TEA_EXAM_CONFIG,
} from './exam-timer';
import {
  ExamSectionControls,
  type ExamControlsConfig,
  TEA_CONTROLS_CONFIG,
} from './exam-section-controls';
// import { AlertTriangle } from 'lucide-react';
import type { UIMessage } from 'ai';

export interface ExamMessagesConfig {
  welcomeMessage: string;
  sectionStartMessages: Record<ExamSection, string>;
  completionMessage: string;
  quickInstructions: string[];
}

// Default TEA messages for backward compatibility
const TEA_MESSAGES_CONFIG: ExamMessagesConfig = {
  welcomeMessage: `¡Bienvenido al simulador del Test de Inglés Aeronáutico (TEA)!

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
  sectionStartMessages: {
    1: `**SECCIÓN 1: ENTREVISTA Y EXPERIENCIA** (7-8 minutos)

Comenzemos con algunas preguntas sobre su experiencia profesional en aviación.

1. **¿Cuál es su rol actual en la aviación?**
   - ¿Es usted piloto, controlador de tráfico aéreo, técnico u otro profesional?
   - ¿Cuántos años de experiencia tiene en este rol?

Por favor, responda de manera detallada y natural.`,
    2: `**SECCIÓN 2: COMPRENSIÓN INTERACTIVA** (8-12 minutos)

Ahora evaluaré su comprensión auditiva. Le presentaré situaciones aeronáuticas que debe interpretar y explicar.`,
    3: `**SECCIÓN 3: DESCRIPCIÓN Y DISCUSIÓN** (10 minutos)

Finalmente, describirá imágenes relacionadas con aviación y participará en una discusión general sobre temas aeronáuticos.`,
  },
  completionMessage: `**🎉 EXAMEN TEA COMPLETADO**

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
  quickInstructions: [
    'Responda de manera natural y completa',
    'Use vocabulario técnico cuando sea apropiado',
    'No se preocupe por errores menores',
    'El evaluador le hará preguntas de seguimiento',
    'Mantenga una conversación fluida',
  ],
};

interface ExamSidebarProps {
  initialMessages: UIMessage[];
  examConfig?: ExamConfig;
  controlsConfig?: ExamControlsConfig;
  messagesConfig?: ExamMessagesConfig;
}

export function ExamSidebar({
  initialMessages,
  examConfig = TEA_EXAM_CONFIG,
  controlsConfig = TEA_CONTROLS_CONFIG,
  messagesConfig = TEA_MESSAGES_CONFIG,
}: ExamSidebarProps) {
  // Estado del examen
  const [examStarted, setExamStarted] = useState(false);
  const [currentSection, setCurrentSection] = useState<ExamSection>(1);
  const [completedSections, setCompletedSections] = useState<ExamSection[]>([]);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [examCompleted, setExamCompleted] = useState(false);
  const [showInstructions, setShowInstructions] = useState(true);

  // Mensajes del chat con instrucciones iniciales
  const [messages, setMessages] = useState<UIMessage[]>(() => {
    if (initialMessages.length === 0) {
      return [
        {
          id: 'exam-welcome',
          role: 'assistant',
          content: '',
          parts: [
            {
              type: 'text',
              text: messagesConfig.welcomeMessage,
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
      id: `exam-section-${currentSection}-start`,
      role: 'assistant',
      content: '',
      parts: [
        {
          type: 'text',
          text: messagesConfig.sectionStartMessages[currentSection],
        },
      ],
      createdAt: new Date(),
      experimental_attachments: [],
    };

    setMessages((prev) => [...prev, sectionStartMessage]);
    toast.success(`Examen ${controlsConfig.name} iniciado - Sección 1`);
  };

  const handleSectionChange = (section: ExamSection) => {
    if (isTimerRunning) {
      toast.warning('Pause el timer antes de cambiar de sección');
      return;
    }

    setCurrentSection(section);

    // Enviar mensaje de cambio de sección
    const sectionMessage: UIMessage = {
      id: `exam-section-${section}-change`,
      role: 'assistant',
      content: '',
      parts: [
        {
          type: 'text',
          text: messagesConfig.sectionStartMessages[section],
        },
      ],
      createdAt: new Date(),
      experimental_attachments: [],
    };

    setMessages((prev) => [...prev, sectionMessage]);
    toast.info(`Cambiado a Sección ${section}`);
  };

  // const handleSectionComplete = (section: ExamSection) => {
  //   if (!completedSections.includes(section)) {
  //     setCompletedSections((prev) => [...prev, section]);
  //     toast.success(`Sección ${section} completada`);

  //     // Auto-avance a la siguiente sección si existe
  //     if (section < controlsConfig.totalSections) {
  //       setTimeout(() => {
  //         handleSectionChange((section + 1) as ExamSection);
  //       }, 2000);
  //     }
  //   }
  // };

  // const handleTimerWarning = (section: ExamSection) => {
  //   toast.warning(`Sección ${section}: Quedan 2 minutos`, {
  //     icon: <AlertTriangle className="size-4" />,
  //   });
  // };

  // const handleToggleTimer = () => {
  //   setIsTimerRunning(!isTimerRunning);
  //   toast.info(isTimerRunning ? 'Timer pausado' : 'Timer reanudado');
  // };

  // const handleResetTimer = (section: ExamSection) => {
  //   toast.info(`Timer de Sección ${section} reiniciado`);
  // };

  const handleEndExam = () => {
    setExamCompleted(true);
    setIsTimerRunning(false);

    const finalMessage: UIMessage = {
      id: 'exam-complete',
      role: 'assistant',
      content: '',
      parts: [
        {
          type: 'text',
          text: messagesConfig.completionMessage,
        },
      ],
      createdAt: new Date(),
      experimental_attachments: [],
    };

    setMessages((prev) => [...prev, finalMessage]);
    toast.success('¡Examen completado exitosamente!');
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {/* {examStarted && (
        <ExamTimer
          currentSection={currentSection}
          examConfig={examConfig}
          onSectionComplete={handleSectionComplete}
          onTimerWarning={handleTimerWarning}
          isRunning={isTimerRunning}
          onToggleTimer={handleToggleTimer}
          onResetTimer={handleResetTimer}
        />
      )} */}

      <ExamSectionControls
        currentSection={currentSection}
        completedSections={completedSections}
        onSectionChange={handleSectionChange}
        onStartExam={handleStartExam}
        onEndExam={handleEndExam}
        examStarted={examStarted}
        isTimerRunning={isTimerRunning}
        controlsConfig={controlsConfig}
      />
      {/* 
      {showInstructions && (
        <Card className="bg-sidebar">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <FileText className="size-4" />
              Instrucciones Rápidas
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs space-y-2">
            {messagesConfig.quickInstructions.map((instruction, index) => (
              <p key={index}>• {instruction}</p>
            ))}
          </CardContent>
        </Card>
      )} */}
    </div>
  );
}
