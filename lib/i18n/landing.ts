export type Locale = 'en' | 'es';

export interface LandingTranslations {
  nav: {
    signIn: string;
    toggleLocale: string;
  };
  hero: {
    badge: string;
    headline: string;
    subheadline: string;
    ctaPrimary: string;
    ctaSecondary: string;
    footnote: string;
  };
  features: [
    { title: string; description: string },
    { title: string; description: string },
    { title: string; description: string },
  ];
  howItWorks: {
    sectionLabel: string;
    steps: [
      { title: string; body: string },
      { title: string; body: string },
      { title: string; body: string },
    ];
  };
  waitlist: {
    heading: string;
    description: string;
    placeholder: string;
    button: string;
    success: string;
    error: string;
    footnote: string;
  };
  footer: {
    brand: string;
  };
}

const en: LandingTranslations = {
  nav: {
    signIn: 'Sign in',
    toggleLocale: 'ES',
  },
  hero: {
    badge: 'ELPAC · ICAO · ATC',
    headline: 'Practice for real.\nPass with confidence.',
    subheadline:
      "AI-powered exam simulations for aviation English proficiency. Train the way you'll be tested.",
    ctaPrimary: 'Try free demo',
    ctaSecondary: 'Join the waitlist',
    footnote: 'Built for pilots and ATC officers · No credit card required',
  },
  features: [
    {
      title: 'Voice-first',
      description:
        'Speak your answers naturally. The AI listens, evaluates pronunciation, fluency, and accuracy in real time.',
    },
    {
      title: 'ICAO-aligned',
      description:
        'Questions and scenarios drawn from real ELPAC and ICAO language proficiency standards.',
    },
    {
      title: 'Instant feedback',
      description:
        'Get a detailed evaluation the moment you finish. No waiting, no guessing where you stand.',
    },
  ],
  howItWorks: {
    sectionLabel: 'How it works',
    steps: [
      {
        title: 'Select your exam',
        body: 'Choose from ELPAC ATC, ICAO oral, or custom scenarios.',
      },
      {
        title: 'Speak with the examiner',
        body: 'The AI plays the role of examiner. Respond as you would in the real test.',
      },
      {
        title: 'Review your score',
        body: 'Receive structured feedback on pronunciation, vocabulary, fluency, and comprehension.',
      },
    ],
  },
  waitlist: {
    heading: 'Be the first to know.',
    description:
      "Early access is limited. Drop your email and we'll reach out when your spot is ready.",
    placeholder: 'you@airline.com',
    button: 'Notify me',
    success: "You're on the list. We'll be in touch.",
    error: 'Something went wrong. Try again.',
    footnote: 'No spam. Just updates.',
  },
  footer: {
    brand: 'AeroChat',
  },
};

const es: LandingTranslations = {
  nav: {
    signIn: 'Iniciar sesión',
    toggleLocale: 'EN',
  },
  hero: {
    badge: 'ELPAC · ICAO · ATC',
    headline: 'Practica de verdad.\nAprueba con confianza.',
    subheadline:
      'Simulaciones de examen impulsadas por IA para la competencia en inglés de aviación. Entrena como te examinarán.',
    ctaPrimary: 'Prueba gratis',
    ctaSecondary: 'Unirse a la lista',
    footnote: 'Para pilotos y controladores · Sin tarjeta de crédito',
  },
  features: [
    {
      title: 'Voz primero',
      description:
        'Responde de forma natural. La IA escucha y evalúa pronunciación, fluidez y precisión en tiempo real.',
    },
    {
      title: 'Alineado con ICAO',
      description:
        'Preguntas y escenarios basados en los estándares reales de competencia lingüística ELPAC e ICAO.',
    },
    {
      title: 'Retroalimentación instantánea',
      description:
        'Recibe una evaluación detallada al terminar. Sin esperas, sin dudas sobre tu nivel.',
    },
  ],
  howItWorks: {
    sectionLabel: 'Cómo funciona',
    steps: [
      {
        title: 'Selecciona tu examen',
        body: 'Elige entre ELPAC ATC, oral ICAO o escenarios personalizados.',
      },
      {
        title: 'Habla con el examinador',
        body: 'La IA actúa como examinador. Responde como lo harías en el examen real.',
      },
      {
        title: 'Revisa tu puntaje',
        body: 'Recibe retroalimentación estructurada sobre pronunciación, vocabulario, fluidez y comprensión.',
      },
    ],
  },
  waitlist: {
    heading: 'Sé el primero en enterarte.',
    description:
      'El acceso anticipado es limitado. Déjanos tu correo y te avisamos cuando tu lugar esté listo.',
    placeholder: 'tu@aerolinea.com',
    button: 'Notifícame',
    success: 'Estás en la lista. Estaremos en contacto.',
    error: 'Algo salió mal. Inténtalo de nuevo.',
    footnote: 'Sin spam. Solo actualizaciones.',
  },
  footer: {
    brand: 'AeroChat',
  },
};

export const translations: Record<Locale, LandingTranslations> = { en, es };
