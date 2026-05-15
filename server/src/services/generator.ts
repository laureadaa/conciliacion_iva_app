// ============================================================
// Local template-based content generation, personalized
// with the user's business settings (name, rate, signature, ...).
// ============================================================

import type {
  EmailType,
  Language,
  Platform,
  ProjectComplexity,
} from "@freelance/shared";

export interface UserContext {
  fullName?: string | null;
  businessName?: string | null;
  hourlyRate?: number;
  currency?: string;
  signature?: string | null;
  website?: string | null;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function signOff(user: UserContext, isEs: boolean): string {
  if (user.signature && user.signature.trim()) return user.signature.trim();
  const closing = isEs
    ? pick(["Un saludo,", "Saludos cordiales,", "Un abrazo,"])
    : pick(["Best regards,", "Best,", "Kind regards,"]);
  const name = user.fullName || user.businessName || "";
  const site = user.website ? `\n${user.website}` : "";
  return name ? `${closing}\n${name}${site}` : closing;
}

function summarize(text: string, isEs: boolean): string {
  const t = text.trim().replace(/\s+/g, " ");
  if (t.length === 0)
    return isEs ? "Avanzar con el proyecto." : "Move the project forward.";
  const sentence = t.split(/[.!?]\s/)[0];
  return sentence.length > 220 ? sentence.slice(0, 220) + "..." : sentence;
}

// ---------------------------------------------------------------
// Project-type specific value props
// ---------------------------------------------------------------

const PROJECT_VALUE_PROPS: Record<string, { es: string; en: string }> = {
  landing: {
    es: "una landing rápida, optimizada para SEO básico y con foco en convertir visitas en leads o ventas",
    en: "a fast landing page, optimized for basic SEO and focused on converting visitors into leads or sales",
  },
  webapp: {
    es: "una aplicación web sólida, con arquitectura escalable, código mantenible y enfoque iterativo",
    en: "a solid web application, with scalable architecture, maintainable code, and an iterative approach",
  },
  ecommerce: {
    es: "una tienda online robusta, optimizada para conversión, con catálogo, carrito y pagos seguros",
    en: "a robust online store, conversion-optimized, with catalog, cart, and secure payments",
  },
  api: {
    es: "una API limpia, documentada con OpenAPI, testeada y lista para integrarse con cualquier cliente",
    en: "a clean, OpenAPI-documented, tested API ready to integrate with any client",
  },
  mobile: {
    es: "una app móvil con UX cuidada, rendimiento optimizado y entrega lista para stores",
    en: "a mobile app with careful UX, optimized performance, and store-ready delivery",
  },
  dashboard: {
    es: "un panel claro y útil para tomar decisiones con datos reales del negocio",
    en: "a clear, useful dashboard for making decisions with real business data",
  },
  consulting: {
    es: "una mirada técnica externa que identifica cuellos de botella y propone soluciones concretas",
    en: "an external technical perspective that spots bottlenecks and proposes concrete solutions",
  },
  maintenance: {
    es: "soporte continuo y mantenimiento que evita sorpresas y mantiene tu producto saludable",
    en: "continuous support and maintenance that prevents surprises and keeps your product healthy",
  },
};

function valueProp(projectType: string, isEs: boolean): string {
  const key = projectType.toLowerCase().trim();
  const match = Object.entries(PROJECT_VALUE_PROPS).find(([k]) => key.includes(k));
  if (match) return match[1][isEs ? "es" : "en"];
  return isEs
    ? "una solución técnica clara, mantenible y alineada con tus objetivos de negocio"
    : "a clear, maintainable technical solution aligned with your business goals";
}

// ---------------------------------------------------------------
// Proposals
// ---------------------------------------------------------------

export function generateProposal(input: {
  projectType: string;
  clientDescription: string;
  budget?: number | null;
  deadline?: string | null;
  language: Language;
  user: UserContext;
}): string {
  const isEs = input.language === "es";
  const summary = summarize(input.clientDescription, isEs);
  const value = valueProp(input.projectType, isEs);
  const currency = input.user.currency || "EUR";

  if (isEs) {
    const greeting = pick(["Hola,", "Buenos días,", "Hola, ¿qué tal?"]);
    const intro = pick([
      `Gracias por contactarme. He leído con atención tu brief y creo que encaja perfectamente con mi experiencia desarrollando ${input.projectType.toLowerCase()}.`,
      `Gracias por la confianza. Tras revisar tu brief sobre el ${input.projectType.toLowerCase()}, tengo bastante claro cómo abordarlo para que el resultado esté a la altura.`,
      `Me ha parecido un proyecto muy interesante. Voy a entrar directamente al grano para que veas si encaja con lo que buscas.`,
    ]);
    const understanding = `Tu necesidad, tal y como la entiendo, es: "${summary}". Lo que te propongo es construir ${value}.`;
    const approach = pick([
      `Trabajo en sprints cortos con entregas semanales: ves avances reales desde la primera semana, das feedback continuo y no te llevas sorpresas al final.`,
      `Empiezo con un MVP funcional en pocas semanas y ampliamos a partir de ahí, priorizando lo que realmente mueve la aguja en tu negocio.`,
      `Combino una arquitectura sólida con un enfoque iterativo: validamos pronto, sumamos funcionalidades sin acumular deuda técnica.`,
    ]);
    const deliverables = `Entregables incluidos: análisis previo y plan técnico, código limpio en repositorio Git con buenas prácticas, documentación, despliegue en entorno productivo y soporte post-entrega.`;
    const budgetLine = input.budget
      ? `El presupuesto orientativo para este alcance es de ${input.budget.toLocaleString()} ${currency}, que podemos ajustar si redefinimos prioridades.`
      : input.user.hourlyRate
        ? `Mi tarifa de referencia es de ${input.user.hourlyRate} ${currency}/hora; podemos cerrar presupuesto fijo o por hitos en función de lo que prefieras.`
        : `Podemos cerrar presupuesto fijo o por hitos en función de lo que prefieras.`;
    const deadlineLine = input.deadline
      ? `El plazo estimado es de ${input.deadline}, con margen para revisiones intermedias.`
      : `Acordamos un calendario realista una vez confirmemos el alcance.`;
    const closing = pick([
      `Si te encaja, te propongo una llamada de 20 minutos esta semana para resolver dudas y arrancar cuanto antes.`,
      `Estoy disponible para una llamada cuando te venga bien y aterrizar los detalles que falten.`,
      `Quedo a tu disposición para concretar siguientes pasos.`,
    ]);

    return [
      greeting,
      "",
      intro,
      "",
      understanding,
      "",
      approach,
      "",
      `${deliverables} ${budgetLine} ${deadlineLine}`,
      "",
      closing,
      "",
      signOff(input.user, true),
    ].join("\n");
  }

  const greeting = pick(["Hi,", "Hello,", "Hi there,"]);
  const intro = pick([
    `Thanks for reaching out. After reviewing your brief for the ${input.projectType.toLowerCase()}, I'm confident this is a great fit for my experience.`,
    `Thanks for sharing the details. Your ${input.projectType.toLowerCase()} project looks like an exciting challenge and aligns well with how I work.`,
    `Appreciate you considering me for this. Let me get straight to the point so you can see if it fits what you need.`,
  ]);
  const understanding = `As I understand it, your need is: "${summary}". What I propose is to build ${value}.`;
  const approach = pick([
    `I work in short sprints with weekly deliveries: you see real progress from week one, provide continuous feedback, and there are no surprises at the end.`,
    `I start with a functional MVP in a few weeks and expand from there, prioritizing what truly moves the needle for your business.`,
    `I combine solid architecture with an iterative approach: validate early, layer features without accumulating tech debt.`,
  ]);
  const deliverables = `Deliverables included: initial analysis and technical plan, clean code in a Git repository following best practices, documentation, production deployment, and post-launch support.`;
  const budgetLine = input.budget
    ? `The estimated budget for this scope is ${input.budget.toLocaleString()} ${currency}, which we can adjust if we re-prioritize.`
    : input.user.hourlyRate
      ? `My reference rate is ${input.user.hourlyRate} ${currency}/hour; we can agree on a fixed price or milestones, whichever fits you better.`
      : `We can agree on either a fixed price or a milestone-based structure.`;
  const deadlineLine = input.deadline
    ? `The estimated timeline is ${input.deadline}, with room for intermediate reviews.`
    : `We'll agree on a realistic timeline once the scope is confirmed.`;
  const closing = pick([
    `If this works for you, I'd love to jump on a 20-minute call this week to clarify any questions and get started.`,
    `Happy to schedule a quick call whenever convenient to nail down the remaining details.`,
    `I'm available to align on next steps and start as soon as possible.`,
  ]);

  return [
    greeting,
    "",
    intro,
    "",
    understanding,
    "",
    approach,
    "",
    `${deliverables} ${budgetLine} ${deadlineLine}`,
    "",
    closing,
    "",
    signOff(input.user, false),
  ].join("\n");
}

// ---------------------------------------------------------------
// Pricing justification
// ---------------------------------------------------------------

export function generateJustification(input: {
  projectType: string;
  complexity: ProjectComplexity;
  extras: string[];
  price: number;
  language: Language;
  user: UserContext;
}): string {
  const isEs = input.language === "es";
  const currency = input.user.currency || "EUR";
  const complexityLabel = {
    basic: { es: "básica", en: "basic" },
    medium: { es: "intermedia", en: "intermediate" },
    advanced: { es: "avanzada", en: "advanced" },
  }[input.complexity];

  const extras = input.extras.length
    ? input.extras.join(", ")
    : isEs
      ? "ninguno destacable"
      : "none in particular";

  if (isEs) {
    return [
      `El precio de ${input.price.toLocaleString()} ${currency} refleja el alcance real del proyecto: un ${input.projectType} de complejidad ${complexityLabel.es}, con los siguientes extras incluidos: ${extras}. No es una estimación arbitraria, sino el resultado de medir las horas necesarias por bloque de trabajo (análisis, diseño técnico, desarrollo, pruebas, despliegue) y aplicar una tarifa de mercado.`,
      `Lo que recibes por ese importe no es solo "código que funciona". Es código mantenible, documentado y desplegado correctamente, con buenas prácticas que evitan que dentro de seis meses pagues el doble en reparaciones. Incluye también soporte tras la entrega, lo que te da margen para detectar ajustes en uso real.`,
      `Bajar este precio implica recortar alcance o calidad. Si el presupuesto es un freno, podemos rediseñar el alcance juntos: priorizar lo imprescindible para arrancar (MVP) y dejar el resto para una segunda fase. Es una opción válida y honesta, mejor que entregar algo a medias por el mismo presupuesto.`,
      `Por último, mi compromiso es entregarte una solución que funcione el primer día y que puedas evolucionar sin depender de mí. Ese es el valor real de la inversión.`,
    ].join("\n\n");
  }

  return [
    `The ${input.price.toLocaleString()} ${currency} price reflects the actual scope of the project: a ${input.projectType} with ${complexityLabel.en} complexity, including these add-ons: ${extras}. It is not an arbitrary estimate, but the result of measuring the hours required per work block (analysis, technical design, development, testing, deployment) and applying a market rate.`,
    `What you get for that price is not just "code that works". It's maintainable, documented, properly deployed code that follows best practices and prevents you from paying twice as much in fixes six months later. It also includes post-launch support, giving you room to spot adjustments after real use.`,
    `Lowering this price means cutting scope or quality. If budget is a concern, we can redesign the scope together: prioritize what's essential to launch (MVP) and leave the rest for a second phase. That's a valid, honest option, far better than delivering a half-baked product for the same budget.`,
    `Finally, my commitment is to deliver a solution that works from day one and that you can evolve without depending on me. That is the real value of the investment.`,
  ].join("\n\n");
}

// ---------------------------------------------------------------
// Profile / bio
// ---------------------------------------------------------------

export function generateProfile(input: {
  name: string;
  yearsExperience: number;
  technologies: string[];
  platform: Platform;
  niche: string;
  language: Language;
}): string {
  const isEs = input.language === "es";
  const stack = input.technologies.join(", ");
  const primaryTech =
    input.technologies.slice(0, 3).join(" / ") ||
    (isEs ? "tecnologías modernas" : "modern stack");

  const intros = {
    malt: {
      es: `${input.name} · Desarrolladora freelance con ${input.yearsExperience} ${input.yearsExperience === 1 ? "año" : "años"} de experiencia en ${input.niche}.`,
      en: `${input.name} · Freelance developer with ${input.yearsExperience} ${input.yearsExperience === 1 ? "year" : "years"} of experience in ${input.niche}.`,
    },
    upwork: {
      es: `¿Necesitas resolver tu ${input.niche} con calidad y sin sobresaltos? Soy ${input.name}, desarrolladora con ${input.yearsExperience} ${input.yearsExperience === 1 ? "año" : "años"} de experiencia y especializada en ${primaryTech}.`,
      en: `Looking to solve your ${input.niche} challenge with quality and zero surprises? I'm ${input.name}, a developer with ${input.yearsExperience} ${input.yearsExperience === 1 ? "year" : "years"} of experience, specialized in ${primaryTech}.`,
    },
    linkedin: {
      es: `Soy ${input.name}, desarrolladora freelance enfocada en ${input.niche}. Llevo ${input.yearsExperience} ${input.yearsExperience === 1 ? "año" : "años"} construyendo producto digital con ${primaryTech}.`,
      en: `I'm ${input.name}, a freelance developer focused on ${input.niche}. I have ${input.yearsExperience} ${input.yearsExperience === 1 ? "year" : "years"} building digital products with ${primaryTech}.`,
    },
    other: {
      es: `${input.name} — desarrolladora freelance · ${input.niche} · ${input.yearsExperience} ${input.yearsExperience === 1 ? "año" : "años"} de experiencia.`,
      en: `${input.name} — Freelance developer · ${input.niche} · ${input.yearsExperience} ${input.yearsExperience === 1 ? "year" : "years"} of experience.`,
    },
  };

  const bodies = {
    malt: {
      es: `Trabajo de extremo a extremo: desde el análisis del problema hasta el despliegue y soporte. Mis stacks principales son ${stack}. Cuido el código (testeable, documentado, mantenible) tanto como el resultado de negocio.\n\nLo que puedes esperar trabajando conmigo: comunicación clara, plazos realistas y entregas que funcionan el primer día. Si tu proyecto va en serio, hablemos.`,
      en: `I work end-to-end: from problem analysis to deployment and support. My main stacks are ${stack}. I care about code quality (testable, documented, maintainable) as much as the business outcome.\n\nWhat you can expect working with me: clear communication, realistic timelines, and deliveries that work from day one. If your project is serious, let's talk.`,
    },
    upwork: {
      es: `Lo que obtienes:\n• Código limpio, testeado y documentado en ${stack}.\n• Comunicación diaria y entregas en sprints cortos.\n• Enfoque en resultados de negocio, no solo en cerrar tickets.\n• Soporte post-entrega incluido.\n\n¿Hablamos? Envíame un mensaje con tu brief y te respondo con un plan en menos de 24 h.`,
      en: `What you get:\n• Clean, tested, documented code in ${stack}.\n• Daily communication and short-sprint deliveries.\n• Focus on business results, not just closing tickets.\n• Post-launch support included.\n\nLet's talk: send me your brief and I'll respond with a plan in under 24 hours.`,
    },
    linkedin: {
      es: `Me apasiona convertir problemas confusos en producto útil. He trabajado con startups y equipos en ${input.niche}, ayudándoles a lanzar más rápido sin renunciar a calidad técnica.\n\nStack habitual: ${stack}. Si tienes un reto interesante, escríbeme.\n\n#freelance #${input.niche.replace(/\s+/g, "")} #desarrollo`,
      en: `I love turning fuzzy problems into useful product. I have partnered with startups and teams in ${input.niche}, helping them ship faster without giving up technical quality.\n\nMy go-to stack: ${stack}. If you have an interesting challenge, drop me a line.\n\n#freelance #${input.niche.replace(/\s+/g, "")} #development`,
    },
    other: {
      es: `Stack principal: ${stack}. Trabajo en remoto, con comunicación clara y entregas en sprints cortos. Disponible para nuevos proyectos.`,
      en: `Main stack: ${stack}. I work remotely with clear communication and short-sprint deliveries. Available for new projects.`,
    },
  };

  return [intros[input.platform][input.language], "", bodies[input.platform][input.language]].join("\n");
}

// ---------------------------------------------------------------
// Emails
// ---------------------------------------------------------------

export function generateEmail(input: {
  type: EmailType;
  clientName: string;
  context: string;
  language: Language;
  user: UserContext;
}): { subject: string; body: string } {
  const isEs = input.language === "es";
  const name = input.clientName;
  const ctx = input.context.trim();
  const sign = signOff(input.user, isEs);

  switch (input.type) {
    case "first_contact":
      return isEs
        ? {
            subject: `Propuesta de colaboración — ${name}`,
            body: `Hola ${name},\n\nSoy desarrolladora freelance y me ha llamado la atención lo que mencionas: ${ctx}.\n\nTrabajo con clientes que tienen retos similares y suelo cubrir el ciclo completo: análisis, desarrollo, despliegue y soporte. Creo que puedo aportarte una solución sólida, sin sorpresas en plazos ni en presupuesto.\n\n¿Te encajaría una llamada breve esta semana para entender mejor lo que necesitas? Si prefieres por escrito, dime y te paso unas preguntas iniciales.\n\n${sign}`,
          }
        : {
            subject: `Quick intro & potential collaboration — ${name}`,
            body: `Hi ${name},\n\nI'm a freelance developer and what you mentioned caught my attention: ${ctx}.\n\nI work with clients facing similar challenges and typically cover the full cycle: analysis, development, deployment, and support. I think I can bring you a solid solution with no surprises in timeline or budget.\n\nWould a short call this week work to better understand your needs? If you'd rather start in writing, just let me know and I'll send a few initial questions.\n\n${sign}`,
          };
    case "follow_up":
      return isEs
        ? {
            subject: `Retomando nuestra conversación — ${name}`,
            body: `Hola ${name},\n\nQuería retomar contigo el tema sobre el que hablamos: ${ctx}. Imagino que estás con muchas cosas, así que solo escribo para confirmarte que sigo disponible y con interés en colaborar.\n\nSi necesitas más información para tomar una decisión, dime qué te falta y te lo preparo. Si por ahora no es el momento, también es buena información.\n\n${sign}`,
          }
        : {
            subject: `Following up — ${name}`,
            body: `Hi ${name},\n\nJust circling back on what we discussed: ${ctx}. I imagine you have a lot on your plate, so this is only to confirm I'm still available and interested in moving forward.\n\nIf you need more information to make a decision, let me know what's missing and I'll put it together. If now isn't the right moment, that's helpful too.\n\n${sign}`,
          };
    case "delivery":
      return isEs
        ? {
            subject: `Entrega del proyecto — ${name}`,
            body: `Hola ${name},\n\nYa puedes revisar la entrega: ${ctx}.\n\nHe verificado que todo funciona en el entorno acordado y dejo a tu disposición acceso al código, documentación técnica y guía rápida de uso. Si encuentras cualquier detalle a ajustar, dímelo; el periodo de soporte post-entrega cubre este tipo de retoques.\n\nGracias por la confianza. Ha sido un placer trabajar contigo.\n\n${sign}`,
          }
        : {
            subject: `Project delivery — ${name}`,
            body: `Hi ${name},\n\nThe delivery is ready for review: ${ctx}.\n\nI've verified everything works in the agreed environment. You have access to the code, technical documentation, and a quick usage guide. If you spot anything that needs adjusting, let me know — the post-delivery support window covers this kind of tweak.\n\nThanks for the trust on this project. It's been a pleasure working with you.\n\n${sign}`,
          };
    case "review_request":
      return isEs
        ? {
            subject: `¿Me dejarías una reseña? — ${name}`,
            body: `Hola ${name},\n\nEspero que el proyecto te esté siendo útil: ${ctx}.\n\nSi has quedado a gusto con el trabajo, ¿te importaría dejarme una reseña corta? Para freelancers, las reseñas son una de las herramientas más útiles para conseguir nuevos clientes con un perfil parecido al tuyo.\n\nSi prefieres, te paso un par de ideas de qué destacar para que te lleve dos minutos. Y si hay algo que mejorar, también me sirve mucho saberlo.\n\nMuchas gracias por adelantado.\n\n${sign}`,
          }
        : {
            subject: `Would you leave me a review? — ${name}`,
            body: `Hi ${name},\n\nHope the project is working out well: ${ctx}.\n\nIf you've been happy with the work, would you mind leaving a short review? For freelancers, reviews are one of the most useful ways to attract new clients with a profile similar to yours.\n\nIf you'd like, I can send a couple of ideas of what to highlight so it only takes you a couple of minutes. And of course, if there's anything to improve, I'd very much like to hear it too.\n\nThanks in advance.\n\n${sign}`,
          };
    case "payment_reminder":
      return isEs
        ? {
            subject: `Recordatorio de factura pendiente — ${name}`,
            body: `Hola ${name},\n\nUn recordatorio amable: la factura correspondiente a ${ctx} aún figura como pendiente en mis registros.\n\nEs posible que se haya cruzado con otros temas o que el banco esté tardando en procesar. Si necesitas que te reenvíe la factura o cualquier dato bancario, dímelo y te lo paso al momento. Si ya está en curso, ignora este mensaje.\n\nGracias por revisarlo cuando puedas.\n\n${sign}`,
          }
        : {
            subject: `Friendly payment reminder — ${name}`,
            body: `Hi ${name},\n\nA gentle reminder: the invoice for ${ctx} is still showing as outstanding on my side.\n\nIt may have gotten lost in the shuffle, or the bank might still be processing it. If you need me to resend the invoice or share any bank details again, just let me know. If it's already in motion, please disregard this note.\n\nThanks for checking when you get a moment.\n\n${sign}`,
          };
  }
}
