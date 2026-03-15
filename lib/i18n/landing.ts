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
    badge: 'ELPAC Exam Prep · ATC Only',
    headline: 'Ace your ELPAC. Speak like a pro on the radio.',
    subheadline:
      'Realistic ATC scenarios. Scored like the real exam. Train in 15 minutes.',
    placeholder: 'you@ansp.com',
    button: 'Request access',
    ctaSecondary: 'See platform preview',
    signInHint: 'Already have access?',
    success: "You are on the list. We'll email you when access opens.",
    error: 'Something went wrong. Please try again.',
    footnote: 'No spam. Early-access updates only.',
  },
  proof: {
    sectionLabel: 'Built around the ELPAC, not generic English',
    items: [
      {
        value: 'ELPAC-accurate',
        label:
          'Scenarios built around the exact tasks and criteria used in official ELPAC evaluations',
      },
      {
        value: 'Speak to pass',
        label:
          'Your voice is evaluated in real time — the same dimensions a human examiner scores',
      },
      {
        value: 'Know your level',
        label:
          'Get a structured score after each session so you know where you stand before exam day',
      },
    ],
  },
  demo: {
    sectionLabel: 'Platform preview',
    heading: 'See the exam experience before launch.',
    body: 'Review the full simulation: ATC scenario prompt, your spoken response, examiner-style feedback, and a breakdown of your score.',
    watchLabel: 'Watch walkthrough',
    duration: '~90 sec preview',
  },
  features: [
    {
      title: 'Realistic scenarios',
      description:
        'Route clearances, weather reports, emergency calls, readbacks — the situations that actually appear in your ELPAC, in English.',
    },
    {
      title: 'Scored like the exam',
      description:
        'Fluency, vocabulary, pronunciation, and comprehension assessed against ICAO Level 4-6 criteria after every session.',
    },
    {
      title: 'On-demand practice',
      description:
        'No scheduling. No waiting. Train whenever you have 15 minutes — from your phone or desktop.',
    },
  ],
  faq: {
    sectionLabel: 'Common questions',
    items: [
      {
        question: 'What is the ELPAC?',
        answer:
          'The ELPAC (English Language Proficiency for Aeronautical Communication) is the mandatory English proficiency test for Air Traffic Controllers worldwide. Most controllers must demonstrate Level 4 or higher to maintain active certification.',
      },
      {
        question: 'What ELPAC level does VectorEnglish target?',
        answer:
          'VectorEnglish is designed to help controllers reach and maintain ELPAC Level 4 — the minimum required for active certification — and push toward Level 5 for longer validity periods.',
      },
      {
        question: 'Is this a replacement for official ELPAC materials?',
        answer:
          'No — it is a complement. VectorEnglish gives you the speaking practice reps that textbooks cannot. The more you speak in realistic scenarios, the more natural your responses become on exam day.',
      },
    ],
  },
  finalCta: {
    heading: 'Your ELPAC is too important to wing it.',
    description:
      'Join the waitlist and be first to access the only ELPAC simulator built specifically for Air Traffic Controllers.',
    button: 'Join the waitlist',
  },
  footer: {
    brand: 'VectorEnglish',
    note: 'ELPAC exam preparation for Air Traffic Controllers.',
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
    badge: 'Preparacion ELPAC · Solo ATC',
    headline: 'Aprueba el ELPAC. Domina las comunicaciones en inglés.',
    subheadline:
      'Escenarios ATC reales. Puntaje como el examen. Entrena en 15 minutos.',
    placeholder: 'tu@ansp.com',
    button: 'Solicitar acceso',
    ctaSecondary: 'Ver vista previa',
    signInHint: 'Ya tienes acceso?',
    success: 'Ya estas en la lista. Te escribiremos cuando se abra tu acceso.',
    error: 'Ocurrio un error. Intentalo de nuevo.',
    footnote: 'Sin spam. Solo novedades de acceso anticipado.',
  },
  proof: {
    sectionLabel: 'Construido para el ELPAC, no para ingles general',
    items: [
      {
        value: 'Preciso para el ELPAC',
        label:
          'Escenarios basados en las tareas y criterios exactos de las evaluaciones oficiales ELPAC',
      },
      {
        value: 'Hablar para aprobar',
        label:
          'Tu voz es evaluada en tiempo real, en las mismas dimensiones que califica un examinador humano',
      },
      {
        value: 'Conoce tu nivel',
        label:
          'Recibe un puntaje estructurado despues de cada sesion para saber donde estas antes del examen',
      },
    ],
  },
  demo: {
    sectionLabel: 'Vista previa',
    heading: 'Mira la experiencia del examen antes del lanzamiento.',
    body: 'Revisa la simulacion completa: escenario ATC, tu respuesta hablada, retroalimentacion estilo examinador y el desglose de tu puntaje.',
    watchLabel: 'Ver recorrido',
    duration: 'Vista previa de ~90 s',
  },
  features: [
    {
      title: 'Escenarios reales',
      description:
        'Autorizaciones de ruta, informes meteorologicos, emergencias, readbacks — las situaciones que aparecen en tu ELPAC, en ingles.',
    },
    {
      title: 'Puntaje como el examen',
      description:
        'Fluidez, vocabulario, pronunciacion y comprension evaluados segun los criterios ICAO Nivel 4-6 despues de cada sesion.',
    },
    {
      title: 'Practica cuando quieras',
      description:
        'Sin horarios. Sin esperas. Entrena cuando tengas 15 minutos, desde tu telefono o computadora.',
    },
  ],
  faq: {
    sectionLabel: 'Preguntas frecuentes',
    items: [
      {
        question: 'Que es el ELPAC?',
        answer:
          'El ELPAC (English Language Proficiency for Aeronautical Communication) es el examen obligatorio de competencia en ingles para controladores de transito aereo en todo el mundo. La mayoria de los controladores debe demostrar Nivel 4 o superior para mantener su certificacion activa.',
      },
      {
        question: 'A que nivel ELPAC apunta VectorEnglish?',
        answer:
          'VectorEnglish esta disenado para ayudar a los controladores a alcanzar y mantener el Nivel 4 del ELPAC — el minimo requerido para certificacion activa — y avanzar hacia el Nivel 5 para periodos de validez mas largos.',
      },
      {
        question: 'Reemplaza esto los materiales oficiales del ELPAC?',
        answer:
          'No, es un complemento. VectorEnglish te da las repeticiones de practica oral que los libros no pueden darte. Cuanto mas hablas en escenarios reales, mas naturales se vuelven tus respuestas el dia del examen.',
      },
    ],
  },
  finalCta: {
    heading: 'Tu ELPAC es demasiado importante para dejarlo al azar.',
    description:
      'Unete a la lista y se el primero en acceder al unico simulador ELPAC construido especificamente para controladores ATC.',
    button: 'Unirme a la lista',
  },
  footer: {
    brand: 'VectorEnglish',
    note: 'Preparacion para el examen ELPAC de controladores ATC.',
  },
};

export const translations: Record<Locale, LandingTranslations> = { en, es };
