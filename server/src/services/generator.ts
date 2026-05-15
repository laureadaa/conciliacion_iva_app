// ============================================================
// Local template-based content generation.
// Replaces an external LLM with deterministic-but-varied output.
// ============================================================

import type {
  EmailType,
  Language,
  Platform,
  ProjectComplexity,
} from "@freelance/shared";

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function cap(s: string) {
  return s.length === 0 ? s : s[0].toUpperCase() + s.slice(1);
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
}): string {
  const isEs = input.language === "es";
  const summary = summarize(input.clientDescription, isEs);

  if (isEs) {
    const greeting = pick(["Hola,", "Buenos días,", "Hola, ¿qué tal?"]);
    const intro = pick([
      `Gracias por contactarme. He leído con atención tu brief y creo que encaja perfectamente con mi experiencia desarrollando ${input.projectType.toLowerCase()}.`,
      `Gracias por la confianza. Tras revisar tu brief sobre el ${input.projectType.toLowerCase()}, tengo bastante claro cómo abordarlo para que el resultado esté a la altura.`,
      `Me ha parecido un proyecto muy interesante. Para tu ${input.projectType.toLowerCase()} te propongo un enfoque pragmático, centrado en lo que aporta valor desde el día uno.`,
    ]);
    const understanding = `Tu necesidad, tal y como la entiendo, es: "${summary}". Mi prioridad es traducirla en una solución técnica clara, mantenible y alineada con tus objetivos de negocio.`;
    const solution = pick([
      `Mi propuesta combina una arquitectura sólida con un enfoque iterativo: empezamos por lo esencial, validamos pronto y vamos sumando funcionalidades sin acumular deuda técnica.`,
      `Trabajaré en sprints cortos con entregas semanales para que puedas ver avances reales desde la primera semana y dar feedback continuo.`,
      `Te propongo arrancar con un MVP funcional en pocas semanas y ampliar a partir de ahí, priorizando lo que mueve la aguja para tu negocio.`,
    ]);
    const deliverables = `Entregables incluidos: análisis previo, código limpio en repositorio Git con buenas prácticas, documentación técnica, despliegue en entorno productivo y soporte post-entrega.`;
    const budgetLine = input.budget
      ? `El presupuesto orientativo para este alcance es de ${input.budget.toLocaleString()} €, que podemos ajustar si redefinimos prioridades.`
      : `Podemos cerrar presupuesto cerrado o por hitos según prefieras.`;
    const deadlineLine = input.deadline
      ? `El plazo estimado es de ${input.deadline}, con margen para revisiones intermedias.`
      : `Acordamos un calendario realista una vez confirmemos el alcance.`;
    const closing = pick([
      `Si te encaja, te propongo una llamada de 20 minutos esta semana para resolver dudas y arrancar cuanto antes.`,
      `Estoy disponible para una llamada cuando te venga bien y aterrizar los detalles que falten.`,
      `Quedo a tu disposición para concretar siguientes pasos y empezar cuanto antes.`,
    ]);
    const sign = pick(["Un saludo,", "Saludos cordiales,", "Un abrazo,"]);

    return [
      greeting,
      "",
      `${intro} ${understanding}`,
      "",
      solution,
      "",
      `${deliverables} ${budgetLine} ${deadlineLine}`,
      "",
      closing,
      "",
      sign,
    ].join("\n");
  }

  // English
  const greeting = pick(["Hi,", "Hello,", "Hi there,"]);
  const intro = pick([
    `Thanks for reaching out. After reviewing your brief for the ${input.projectType.toLowerCase()}, I'm confident this is a great fit for my experience.`,
    `Thanks for sharing the details. Your ${input.projectType.toLowerCase()} project looks like an exciting challenge and aligns well with how I work.`,
    `Appreciate you considering me for this. Your ${input.projectType.toLowerCase()} can be delivered with a pragmatic approach that focuses on business impact from day one.`,
  ]);
  const understanding = `As I understand it, your need is: "${summary}". My priority is to turn that into a clear, maintainable technical solution that supports your business goals.`;
  const solution = pick([
    `My proposal combines a solid architecture with an iterative approach: start with the essentials, validate early, and layer features without accumulating tech debt.`,
    `I work in short sprints with weekly deliveries so you can see real progress from week one and provide continuous feedback.`,
    `I suggest starting with a functional MVP within a few weeks and expanding from there, prioritizing what moves the needle for your business.`,
  ]);
  const deliverables = `Deliverables included: initial analysis, clean code in a Git repository following best practices, technical documentation, production deployment, and post-launch support.`;
  const budgetLine = input.budget
    ? `The estimated budget for this scope is ${input.budget.toLocaleString()} EUR, which we can adjust if we re-prioritize.`
    : `We can agree on either a fixed price or a milestone-based structure, whichever fits you better.`;
  const deadlineLine = input.deadline
    ? `The estimated timeline is ${input.deadline}, with room for intermediate reviews.`
    : `We'll agree on a realistic timeline once the scope is confirmed.`;
  const closing = pick([
    `If this works for you, I'd love to jump on a 20-minute call this week to clarify any questions and get started.`,
    `Happy to schedule a quick call whenever convenient to nail down the remaining details.`,
    `I'm available to align on next steps and start as soon as possible.`,
  ]);
  const sign = pick(["Best regards,", "Best,", "Kind regards,"]);

  return [
    greeting,
    "",
    `${intro} ${understanding}`,
    "",
    solution,
    "",
    `${deliverables} ${budgetLine} ${deadlineLine}`,
    "",
    closing,
    "",
    sign,
  ].join("\n");
}

function summarize(text: string, isEs: boolean): string {
  const t = text.trim().replace(/\s+/g, " ");
  if (t.length === 0)
    return isEs ? "Avanzar con el proyecto." : "Move the project forward.";
  // Keep first sentence, trim if huge.
  const sentence = t.split(/[.!?]\s/)[0];
  return sentence.length > 220 ? sentence.slice(0, 220) + "..." : sentence;
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
}): string {
  const isEs = input.language === "es";
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
      `El precio de ${input.price.toLocaleString()} € refleja el alcance real del proyecto: un ${input.projectType} de complejidad ${complexityLabel.es}, con los siguientes extras incluidos: ${extras}. No es una estimación arbitraria, sino el resultado de medir las horas necesarias por bloque de trabajo (análisis, diseño técnico, desarrollo, pruebas, despliegue) y aplicar una tarifa de mercado.`,
      `Lo que recibes por ese importe no es solo "código que funciona". Es código mantenible, documentado y desplegado correctamente, con buenas prácticas que evitan que dentro de seis meses pagues el doble en reparaciones. Incluye también soporte tras la entrega, lo que te da margen para detectar ajustes en uso real.`,
      `Bajar este precio implica recortar alcance o calidad. Si el presupuesto es un freno, podemos rediseñar el alcance juntos: priorizar lo imprescindible para arrancar (MVP) y dejar el resto para una segunda fase. Es una opción válida y honesta, mejor que entregar algo a medias por el mismo presupuesto.`,
      `Por último, mi compromiso es entregarte una solución que funcione el primer día y que puedas evolucionar sin depender de mí. Ese es el valor real de la inversión, más allá del importe.`,
    ].join("\n\n");
  }

  return [
    `The ${input.price.toLocaleString()} EUR price reflects the actual scope of the project: a ${input.projectType} with ${complexityLabel.en} complexity, including these add-ons: ${extras}. It is not an arbitrary estimate, but the result of measuring the hours required per work block (analysis, technical design, development, testing, deployment) and applying a market rate.`,
    `What you get for that price is not just "code that works". It's maintainable, documented, properly deployed code that follows best practices and prevents you from paying twice as much in fixes six months later. It also includes post-launch support, giving you room to spot adjustments after real use.`,
    `Lowering this price means cutting scope or quality. If budget is a concern, we can redesign the scope together: prioritize what's essential to launch (MVP) and leave the rest for a second phase. That's a valid, honest option, far better than delivering a half-baked product for the same budget.`,
    `Finally, my commitment is to deliver a solution that works from day one and that you can evolve without depending on me. That is the real value of the investment, beyond the figure itself.`,
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
  const primaryTech = input.technologies.slice(0, 3).join(" / ") || (isEs ? "tecnologías modernas" : "modern stack");

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
}): { subject: string; body: string } {
  const isEs = input.language === "es";
  const name = input.clientName;
  const ctx = input.context.trim();

  switch (input.type) {
    case "first_contact":
      return isEs
        ? {
            subject: `Propuesta de colaboración — ${name}`,
            body: `Hola ${name},\n\nSoy desarrolladora freelance y me ha llamado la atención lo que mencionas: ${ctx}.\n\nTrabajo con clientes que tienen retos similares y suelo cubrir el ciclo completo: análisis, desarrollo, despliegue y soporte. Creo que puedo aportarte una solución sólida, sin sorpresas en plazos ni en presupuesto.\n\n¿Te encajaría una llamada breve esta semana para entender mejor lo que necesitas y ver si tiene sentido seguir? Si prefieres por escrito, dime y te paso unas preguntas iniciales para arrancar.\n\nUn saludo,`,
          }
        : {
            subject: `Quick intro & potential collaboration — ${name}`,
            body: `Hi ${name},\n\nI'm a freelance developer and what you mentioned caught my attention: ${ctx}.\n\nI work with clients facing similar challenges and typically cover the full cycle: analysis, development, deployment, and support. I think I can bring you a solid solution with no surprises in timeline or budget.\n\nWould a short call this week work to better understand your needs and see if it makes sense to keep talking? If you'd rather start in writing, just let me know and I'll send a few initial questions.\n\nBest,`,
          };
    case "follow_up":
      return isEs
        ? {
            subject: `Retomando nuestra conversación — ${name}`,
            body: `Hola ${name},\n\nQuería retomar contigo el tema sobre el que hablamos: ${ctx}. Imagino que estás con muchas cosas, así que solo escribo para confirmarte que sigo disponible y con interés en colaborar.\n\nSi necesitas más información para tomar una decisión, dime qué te falta y te lo preparo. Si por ahora no es el momento, también es buena información: lo dejamos guardado y retomamos cuando lo veas claro.\n\nUn saludo,`,
          }
        : {
            subject: `Following up — ${name}`,
            body: `Hi ${name},\n\nJust circling back on what we discussed: ${ctx}. I imagine you have a lot on your plate, so this is only to confirm I'm still available and interested in moving forward.\n\nIf you need more information to make a decision, let me know what's missing and I'll put it together. If now isn't the right moment, that's helpful too — we can pause and pick it back up when it makes sense.\n\nBest,`,
          };
    case "delivery":
      return isEs
        ? {
            subject: `Entrega del proyecto — ${name}`,
            body: `Hola ${name},\n\nYa puedes revisar la entrega: ${ctx}.\n\nHe verificado que todo funciona en el entorno acordado y dejo a tu disposición acceso al código, documentación técnica y guía rápida de uso. Si encuentras cualquier detalle a ajustar, dímelo y lo veo cuanto antes; el periodo de soporte post-entrega cubre este tipo de retoques.\n\nGracias por la confianza en el proyecto. Ha sido un placer trabajar contigo.\n\nUn saludo,`,
          }
        : {
            subject: `Project delivery — ${name}`,
            body: `Hi ${name},\n\nThe delivery is ready for review: ${ctx}.\n\nI've verified everything works in the agreed environment. You have access to the code, technical documentation, and a quick usage guide. If you spot anything that needs adjusting, let me know and I'll get to it quickly — the post-delivery support window covers this kind of tweak.\n\nThanks for the trust on this project. It's been a pleasure working with you.\n\nBest,`,
          };
    case "review_request":
      return isEs
        ? {
            subject: `¿Me dejarías una reseña? — ${name}`,
            body: `Hola ${name},\n\nEspero que el proyecto te esté siendo útil: ${ctx}.\n\nSi has quedado a gusto con el trabajo, ¿te importaría dejarme una reseña corta? Para freelancers, las reseñas son una de las herramientas más útiles para conseguir nuevos clientes con un perfil parecido al tuyo.\n\nSi prefieres, te paso un par de ideas de qué destacar para que te lleve dos minutos. Y por supuesto, si hay algo que mejorar también me sirve mucho saberlo.\n\nMuchas gracias por adelantado.\n\nUn saludo,`,
          }
        : {
            subject: `Would you leave me a review? — ${name}`,
            body: `Hi ${name},\n\nHope the project is working out well: ${ctx}.\n\nIf you've been happy with the work, would you mind leaving a short review? For freelancers, reviews are one of the most useful ways to attract new clients with a profile similar to yours.\n\nIf you'd like, I can send a couple of ideas of what to highlight so it only takes you a couple of minutes. And of course, if there's anything to improve, I'd very much like to hear it too.\n\nThanks in advance.\n\nBest,`,
          };
    case "payment_reminder":
      return isEs
        ? {
            subject: `Recordatorio de factura pendiente — ${name}`,
            body: `Hola ${name},\n\nUn recordatorio amable: la factura correspondiente a ${ctx} aún figura como pendiente en mis registros.\n\nEs posible que se haya cruzado con otros temas o que el banco esté tardando en procesar — pasa a veces. Si necesitas que te reenvíe la factura o cualquier dato bancario, dímelo y te lo paso al momento. Si ya está en curso, ignora este mensaje.\n\nGracias por revisarlo cuando puedas.\n\nUn saludo,`,
          }
        : {
            subject: `Friendly payment reminder — ${name}`,
            body: `Hi ${name},\n\nA gentle reminder: the invoice for ${ctx} is still showing as outstanding on my side.\n\nIt may have gotten lost in the shuffle, or the bank might still be processing it — it happens. If you need me to resend the invoice or share any bank details again, just let me know and I'll send them right away. If it's already in motion, please disregard this note.\n\nThanks for checking when you get a moment.\n\nBest,`,
          };
  }
}
