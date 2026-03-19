export type Locale = 'en' | 'es';

export interface LandingTranslations {
  nav: {
    brand: string;
    signIn: string;
    toggleLocale: string;
    joinWaitlist: string;
  };
  hero: {
    badge: string;
    headline: string;
    subheadline: string;
    placeholder: string;
    button: string;
    ctaSecondary: string;
    signInHint: string;
    success: string;
    error: string;
    offer: string;
    footnote: string;
    shareButton: string;
    shareHint: string;
    shareMessage: string;
  };
  trust: {
    sectionLabel: string;
    items: Array<{ title: string; description: string }>;
  };
  howItWorks: {
    sectionLabel: string;
    heading: string;
    body: string;
    steps: Array<{ title: string; description: string }>;
    button: string;
    previewLabel: string;
    promptLabel: string;
    timerLabel: string;
    duration: string;
  };
  scoring: {
    sectionLabel: string;
    heading: string;
    body: string;
    criteria: Array<{ name: string; description: string }>;
    note: string;
  };
  comparison: {
    sectionLabel: string;
    heading: string;
    leftTitle: string;
    leftPoints: string[];
    rightTitle: string;
    rightPoints: string[];
  };
  faq: {
    sectionLabel: string;
    items: Array<{ question: string; answer: string }>;
  };
  finalCta: {
    badge: string;
    heading: string;
    description: string;
    button: string;
    urgency: string;
    microcopy: string;
  };
  footer: {
    brand: string;
    note: string;
    disclaimer: string;
  };
}

const en: LandingTranslations = {
  nav: {
    brand: 'VectorEnglish',
    signIn: 'Sign in',
    toggleLocale: 'ES',
    joinWaitlist: 'Join waitlist',
  },
  hero: {
    badge: 'Realistic Aviation English Preparation',
    headline: 'Practice under real ATC pressure before your exam day.',
    subheadline:
      'VectorEnglish gives controllers and serious aviation English candidates practical radio-style speaking sessions to improve confidence and performance before high-stakes assessments.',
    placeholder: 'you@ansp.com',
    button: 'Reserve my early-access spot',
    ctaSecondary: 'See how it works',
    signInHint: 'Already on the platform?',
    success: "You're on the waitlist. We'll send your early-access invite.",
    error: 'Something went wrong. Please try again.',
    offer: 'First 30 people on the waitlist receive a special launch offer.',
    footnote: 'Takes 10 seconds. We only send launch and access updates.',
    shareButton: 'Share on WhatsApp',
    shareHint: 'Forward this page to a colleague preparing this year.',
    shareMessage:
      'I found VectorEnglish for realistic ATC speaking practice before aviation English exams. Join the waitlist:',
  },
  trust: {
    sectionLabel: 'Built for realistic preparation, not generic lessons',
    items: [
      {
        title: 'Radio-style communication',
        description:
          'Train with phraseology-heavy prompts, readbacks, clarifications, and unexpected turns.',
      },
      {
        title: 'Time pressure and interaction',
        description:
          'Respond inside realistic timing constraints with dynamic follow-up prompts.',
      },
      {
        title: 'Focused 10-15 minute sessions',
        description:
          'Do practical speaking reps even on shift days without long study blocks.',
      },
    ],
  },
  howItWorks: {
    sectionLabel: 'How it works',
    heading: 'Three steps to stronger performance before the real exam',
    body: 'Each session mirrors operational speaking demands: hear the scenario, respond clearly, and review structured feedback.',
    steps: [
      {
        title: 'Enter a realistic scenario',
        description:
          'Start with ATC-oriented prompts based on situations controllers face in real operations and exam preparation.',
      },
      {
        title: 'Respond by voice under time pressure',
        description:
          'Practice practical speaking in a radio-like flow where timing and clarity both matter.',
      },
      {
        title: 'Review actionable feedback and repeat',
        description:
          'Use criterion-based feedback to target weak points and improve session by session.',
      },
    ],
    button: 'Join waitlist',
    previewLabel: 'Sample session',
    promptLabel: 'Scenario prompt',
    timerLabel: 'Live response',
    duration: '~90 sec preview',
  },
  scoring: {
    sectionLabel: 'Scoring credibility',
    heading: 'Feedback designed to simulate how evaluators think',
    body: 'After each session you receive structured feedback based on aviation English proficiency criteria, so you know what to improve next.',
    criteria: [
      {
        name: 'Fluency and pace',
        description:
          'Consistency, pauses, and delivery under operational pace.',
      },
      {
        name: 'Pronunciation clarity',
        description:
          'Intelligibility for radio communication and reduced ambiguity.',
      },
      {
        name: 'Vocabulary and structure',
        description:
          'Aviation-relevant phrasing plus clear grammatical control.',
      },
      {
        name: 'Comprehension',
        description:
          'Ability to understand instructions and changes accurately.',
      },
      {
        name: 'Interaction management',
        description:
          'Clarifications, confirmations, and effective readback flow.',
      },
      {
        name: 'Operational accuracy',
        description: 'Correct handling of headings, levels, speed, and intent.',
      },
    ],
    note: 'VectorEnglish is an independent preparation platform. It does not provide official ELPAC scoring, certification, or exam administration.',
  },
  comparison: {
    sectionLabel: 'Why VectorEnglish',
    heading:
      'Built for ATC professionals and serious aviation English candidates',
    leftTitle: 'Generic English practice',
    leftPoints: [
      'General conversation topics with limited operational relevance',
      'No realistic radio pressure or readback practice',
      'Feedback is broad and difficult to apply to exam performance',
    ],
    rightTitle: 'VectorEnglish practice',
    rightPoints: [
      'ATC-oriented scenarios with realistic communication flow',
      'Radio-style prompts, timing pressure, and practical speaking reps',
      'Structured criterion-based feedback for targeted improvement',
    ],
  },
  faq: {
    sectionLabel: 'FAQ',
    items: [
      {
        question: 'Is VectorEnglish an official ELPAC provider?',
        answer:
          'No. VectorEnglish is an independent preparation platform. It is not affiliated with, endorsed by, or administered by EUROCONTROL or the ELPAC exam.',
      },
      {
        question: 'Who is this designed for?',
        answer:
          'VectorEnglish is designed for ATC professionals and serious aviation English candidates preparing for ELPAC and similar proficiency assessments.',
      },
      {
        question: 'Does this replace official exam preparation materials?',
        answer:
          'No. It complements official guidance by giving you realistic speaking practice reps, feedback, and performance tracking between formal study sessions.',
      },
      {
        question: 'How long is each practice session?',
        answer:
          'Most sessions are designed to fit into 10-15 minutes so you can train consistently, even on busy operational days.',
      },
      {
        question: 'What do the first 30 waitlist spots receive?',
        answer:
          'The first 30 people on the waitlist will receive a special launch offer when early access opens.',
      },
    ],
  },
  finalCta: {
    badge: 'Early access',
    heading: 'Do your hardest practice before exam day, not during it.',
    description:
      'Join the VectorEnglish waitlist for realistic ELPAC-focused practice and be first in line when launch access opens.',
    button: 'Join the waitlist',
    urgency: 'First 30 signups get a special launch offer.',
    microcopy: 'Invite teammates who are preparing too.',
  },
  footer: {
    brand: 'VectorEnglish',
    note: 'Realistic aviation English practice for ATC-focused preparation.',
    disclaimer:
      'VectorEnglish is an independent preparation platform and is not affiliated with, endorsed by, or administered by EUROCONTROL or the ELPAC exam.',
  },
};

const es: LandingTranslations = {
  nav: {
    brand: 'VectorEnglish',
    signIn: 'Iniciar sesion',
    toggleLocale: 'EN',
    joinWaitlist: 'Unirse a la lista',
  },
  hero: {
    badge: 'Preparacion realista de ingles aeronautico',
    headline: 'Practica bajo presion ATC real antes del examen.',
    subheadline:
      'Sesiones habladas estilo radio para controladores y candidatos serios de ingles aeronautico que quieren llegar con mas confianza y mejor rendimiento al examen.',
    placeholder: 'tu@ansp.com',
    button: 'Reservar mi cupo de acceso temprano',
    ctaSecondary: 'Ver como funciona',
    signInHint: 'Ya estas en la plataforma?',
    success: 'Ya estas en la lista. Te enviaremos tu invitacion de acceso.',
    error: 'Ocurrio un error. Intentalo de nuevo.',
    offer: 'Primeras 30 personas en la lista: oferta especial de lanzamiento.',
    footnote:
      'Toma 10 segundos. Solo enviamos novedades de acceso y lanzamiento.',
    shareButton: 'Compartir por WhatsApp',
    shareHint: 'Comparte esta pagina con un colega que se este preparando.',
    shareMessage:
      'Encontre VectorEnglish para practicar speaking ATC realista antes de examenes de ingles aeronautico. Unete a la lista:',
  },
  trust: {
    sectionLabel: 'Disenado para practica realista, no para clases genericas',
    items: [
      {
        title: 'Comunicacion estilo radio',
        description:
          'Entrena con prompts de fraseologia, readbacks, aclaraciones y cambios inesperados.',
      },
      {
        title: 'Presion de tiempo e interaccion',
        description:
          'Responde dentro de tiempos realistas con repreguntas dinamicas.',
      },
      {
        title: 'Sesiones enfocadas de 10-15 minutos',
        description:
          'Haz practica oral util incluso en dias de turno sin bloques largos de estudio.',
      },
    ],
  },
  howItWorks: {
    sectionLabel: 'Como funciona',
    heading: 'Tres pasos para rendir mejor antes del examen real',
    body: 'Cada sesion refleja exigencias operativas: escucha el escenario, responde con claridad y revisa retroalimentacion estructurada.',
    steps: [
      {
        title: 'Entra a un escenario realista',
        description:
          'Comienza con prompts orientados a ATC basados en situaciones de operacion y preparacion de examen.',
      },
      {
        title: 'Responde por voz bajo presion de tiempo',
        description:
          'Practica speaking practico en flujo tipo radio donde importan tiempo y claridad.',
      },
      {
        title: 'Revisa feedback accionable y repite',
        description:
          'Usa retroalimentacion por criterios para atacar puntos debiles y mejorar sesion tras sesion.',
      },
    ],
    button: 'Unirme a la lista',
    previewLabel: 'Sesion de ejemplo',
    promptLabel: 'Prompt de escenario',
    timerLabel: 'Respuesta en vivo',
    duration: 'Vista previa de ~90 s',
  },
  scoring: {
    sectionLabel: 'Credibilidad del feedback',
    heading: 'Feedback disenado para simular como piensa un evaluador',
    body: 'Despues de cada sesion recibes retroalimentacion estructurada basada en criterios de competencia de ingles aeronautico para saber que mejorar a continuacion.',
    criteria: [
      {
        name: 'Fluidez y ritmo',
        description: 'Consistencia, pausas y entrega bajo ritmo operativo.',
      },
      {
        name: 'Claridad de pronunciacion',
        description: 'Inteligibilidad en radio y menor ambiguedad.',
      },
      {
        name: 'Vocabulario y estructura',
        description:
          'Fraseologia relevante de aviacion con control gramatical claro.',
      },
      {
        name: 'Comprension',
        description:
          'Capacidad de entender instrucciones y cambios con precision.',
      },
      {
        name: 'Manejo de interaccion',
        description: 'Aclaraciones, confirmaciones y flujo de readback eficaz.',
      },
      {
        name: 'Precision operativa',
        description:
          'Manejo correcto de rumbos, niveles, velocidad e intencion.',
      },
    ],
    note: 'VectorEnglish es una plataforma independiente de preparacion. No entrega puntaje oficial ELPAC, certificacion ni administracion de examen.',
  },
  comparison: {
    sectionLabel: 'Por que VectorEnglish',
    heading:
      'Hecho para profesionales ATC y candidatos serios de ingles aeronautico',
    leftTitle: 'Practica generica de ingles',
    leftPoints: [
      'Temas de conversacion general con poca relevancia operativa',
      'Sin presion realista de radio ni practica de readbacks',
      'Feedback amplio y dificil de aplicar al rendimiento de examen',
    ],
    rightTitle: 'Practica con VectorEnglish',
    rightPoints: [
      'Escenarios orientados a ATC con flujo realista de comunicacion',
      'Prompts estilo radio, presion de tiempo y speaking practico',
      'Feedback estructurado por criterios para mejorar con foco',
    ],
  },
  faq: {
    sectionLabel: 'Preguntas frecuentes',
    items: [
      {
        question: 'VectorEnglish es un proveedor oficial del ELPAC?',
        answer:
          'No. VectorEnglish es una plataforma independiente de preparacion. No esta afiliada, avalada ni administrada por EUROCONTROL ni por el examen ELPAC.',
      },
      {
        question: 'Para quien esta disenado?',
        answer:
          'VectorEnglish esta disenado para profesionales ATC y candidatos serios de ingles aeronautico que se preparan para ELPAC y evaluaciones similares.',
      },
      {
        question: 'Esto reemplaza materiales oficiales de preparacion?',
        answer:
          'No. Es un complemento para sumar practica oral realista, feedback y seguimiento de rendimiento entre sesiones de estudio formal.',
      },
      {
        question: 'Cuanto dura cada sesion de practica?',
        answer:
          'La mayoria de sesiones esta disenada para 10-15 minutos, para que puedas practicar de forma constante incluso en dias operativos exigentes.',
      },
      {
        question: 'Que reciben los primeros 30 cupos de la lista?',
        answer:
          'Las primeras 30 personas en la lista recibiran una oferta especial de lanzamiento cuando se abra el acceso temprano.',
      },
    ],
  },
  finalCta: {
    badge: 'Acceso temprano',
    heading:
      'Haz tu practica mas exigente antes del examen, no durante el examen.',
    description:
      'Unete a la lista de VectorEnglish para practica realista enfocada en ELPAC y queda primero cuando se abra el acceso.',
    button: 'Unirme a la lista',
    urgency:
      'Los primeros 30 registros reciben una oferta especial de lanzamiento.',
    microcopy: 'Invita a colegas que tambien se esten preparando.',
  },
  footer: {
    brand: 'VectorEnglish',
    note: 'Practica realista de ingles aeronautico para preparacion enfocada en ATC.',
    disclaimer:
      'VectorEnglish es una plataforma independiente de preparacion y no esta afiliada, avalada ni administrada por EUROCONTROL ni por el examen ELPAC.',
  },
};

export const translations: Record<Locale, LandingTranslations> = { en, es };
