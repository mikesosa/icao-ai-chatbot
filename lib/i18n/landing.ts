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
    footnote: string;
  };
  proof: {
    sectionLabel: string;
    items: [
      { value: string; label: string },
      { value: string; label: string },
      { value: string; label: string },
    ];
  };
  demo: {
    sectionLabel: string;
    heading: string;
    body: string;
    watchLabel: string;
    duration: string;
  };
  features: [
    { title: string; description: string },
    { title: string; description: string },
    { title: string; description: string },
  ];
  faq: {
    sectionLabel: string;
    items: [
      { question: string; answer: string },
      { question: string; answer: string },
      { question: string; answer: string },
    ];
  };
  finalCta: {
    heading: string;
    description: string;
    button: string;
  };
  footer: {
    brand: string;
    note: string;
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
    badge: 'ELPAC / ICAO / ATC',
    headline: 'Train for the real radio. Pass with calm confidence.',
    subheadline:
      "Voice-first exam simulations for ATC English proficiency. Practice exactly how you'll be evaluated.",
    placeholder: 'you@ansp.com',
    button: 'Request access',
    ctaSecondary: 'See platform preview',
    signInHint: 'Already have access?',
    success: "You are on the list. We'll email you when access opens.",
    error: 'Something went wrong. Please try again.',
    footnote: 'No spam. Early-access updates only.',
  },
  proof: {
    sectionLabel: 'Why controllers join early',
    items: [
      {
        value: 'Voice-first',
        label: 'Speak naturally in realistic ATC radio communication scenarios',
      },
      {
        value: 'ICAO-aware',
        label: 'Tasks aligned to ELPAC and ICAO English proficiency standards',
      },
      {
        value: 'Fast feedback',
        label: 'See fluency and communication gaps right after each run',
      },
    ],
  },
  demo: {
    sectionLabel: 'Platform preview',
    heading: 'See the exam experience before launch.',
    body: 'Review the simulation flow: prompt, speaking response, evaluator feedback, and next-step coaching.',
    watchLabel: 'Watch walkthrough',
    duration: '~90 sec preview',
  },
  features: [
    {
      title: 'Voice-first',
      description:
        'Respond by voice in test-style prompts with realistic pacing and pressure.',
    },
    {
      title: 'Exam aligned',
      description:
        'Practice ELPAC and ICAO-style ATC communication with scenario-driven tasks.',
    },
    {
      title: 'Actionable scoring',
      description:
        'Get immediate feedback on clarity, fluency, phraseology, and confidence.',
    },
  ],
  faq: {
    sectionLabel: 'FAQ',
    items: [
      {
        question: 'Who is VectorEnglish for?',
        answer:
          'VectorEnglish is built exclusively for Air Traffic Controllers preparing for ELPAC and ICAO English proficiency evaluations.',
      },
      {
        question: 'What does the waitlist give me?',
        answer:
          'You get early access invitations, release notes, and onboarding priority as new exam flows roll out.',
      },
      {
        question: 'Do I need a card to join?',
        answer:
          'No. Joining the waitlist only requires an email. Billing starts only if you later activate a plan.',
      },
    ],
  },
  finalCta: {
    heading: 'Get first access to VectorEnglish.',
    description:
      'Join the queue now and we will notify you as soon as your seat opens.',
    button: 'Join the waitlist',
  },
  footer: {
    brand: 'VectorEnglish',
    note: 'Aviation English simulation for Air Traffic Controllers.',
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
    badge: 'ELPAC / ICAO / ATC',
    headline: 'Entrena para la radio real. Aprueba con confianza.',
    subheadline:
      'Simulaciones de examen por voz para competencia en ingles ATC. Practica exactamente como te evaluaran.',
    placeholder: 'tu@ansp.com',
    button: 'Solicitar acceso',
    ctaSecondary: 'Ver vista previa',
    signInHint: 'Ya tienes acceso?',
    success: 'Ya estas en la lista. Te escribiremos cuando se abra tu acceso.',
    error: 'Ocurrio un error. Intentalo de nuevo.',
    footnote: 'Sin spam. Solo novedades de acceso anticipado.',
  },
  proof: {
    sectionLabel: 'Por que los controladores se unen temprano',
    items: [
      {
        value: 'Primero voz',
        label: 'Responde de forma natural en escenarios reales de radio ATC',
      },
      {
        value: 'Con enfoque ICAO',
        label:
          'Tareas alineadas a estandares ELPAC e ICAO de competencia en ingles',
      },
      {
        value: 'Feedback rapido',
        label: 'Identifica vacios de fluidez y comunicacion al instante',
      },
    ],
  },
  demo: {
    sectionLabel: 'Vista previa',
    heading: 'Mira la experiencia del examen antes del lanzamiento.',
    body: 'Revisa el flujo completo: prompt, respuesta hablada, evaluacion y recomendaciones de mejora.',
    watchLabel: 'Ver recorrido',
    duration: 'Vista previa de ~90 s',
  },
  features: [
    {
      title: 'Voz primero',
      description:
        'Responde por voz en prompts de examen con ritmo y presion realistas.',
    },
    {
      title: 'Alineado al examen',
      description:
        'Practica comunicacion estilo ELPAC e ICAO con tareas basadas en escenarios ATC.',
    },
    {
      title: 'Puntaje accionable',
      description:
        'Obtiene feedback inmediato sobre claridad, fluidez, fraseologia y confianza.',
    },
  ],
  faq: {
    sectionLabel: 'Preguntas frecuentes',
    items: [
      {
        question: 'Para quien es VectorEnglish?',
        answer:
          'VectorEnglish esta pensado exclusivamente para controladores de transito aereo (ATC) que preparan evaluaciones ELPAC e ICAO.',
      },
      {
        question: 'Que recibo al unirme a la lista?',
        answer:
          'Recibiras invitaciones de acceso anticipado, novedades y prioridad de onboarding.',
      },
      {
        question: 'Necesito tarjeta para entrar a la lista?',
        answer:
          'No. Solo dejas tu correo para reservar lugar. El cobro solo aplica si activas un plan despues.',
      },
    ],
  },
  finalCta: {
    heading: 'Consigue acceso temprano a VectorEnglish.',
    description:
      'Unete ahora y te avisaremos en cuanto tu lugar este habilitado.',
    button: 'Unirme a la lista',
  },
  footer: {
    brand: 'VectorEnglish',
    note: 'Simulacion de ingles aeronautico para controladores ATC.',
  },
};

export const translations: Record<Locale, LandingTranslations> = { en, es };
