/**
 * Creator & Identity Knowledge Service
 * Enforces official Kiaan AI creator identity: Rohit Patidar 😎 & Kiaan Technology
 */

export class CreatorService {
  /**
   * Check if user prompt is asking about who created/made Kiaan AI
   * or asking about Rohit Patidar / Kiaan Technology.
   *
   * @param {string} prompt
   * @returns {boolean}
   */
  static isCreatorQuery(prompt = '') {
    if (!prompt || typeof prompt !== 'string') return false;
    const p = prompt.trim().toLowerCase();

    // 1. Direct patterns for "who made / created / built / developed you / Kiaan AI"
    const directPatterns = [
      /kisne\s+(banaya|create\s*kiya|develop\s*kiya|design\s*kiya|code\s*kiya)/i,
      /kiske\s+dwara\s+(banaya|create|develop)/i,
      /kaun\s+(banaya|create\s*kiya|developer\s*hai|creator\s*hai|founder\s*hai|malik\s*hai)/i,
      /(tumhe|tujhe|isko|ye|kiaan|kiaan\s*ai)\s+(kisne|kaun)\s+(banaya|create|develop)/i,
      /(kisne|kaun)\s+(banaya|create\s*kiya)\s+(tumhe|tujhe|kiaan|kiaan\s*ai|isko|ye)/i,
      /who\s+(created|made|built|developed|designed|coded|invented)\s*(you|kiaan|kiaan\s*ai|this\s*ai|this\s*chatbot)?/i,
      /who\s+is\s+(your\s+)?(creator|developer|founder|maker|author|father|master|owner)/i,
      /who\s+is\s+rohit(\s+patidar)?/i,
      /rohit\s+patidar\s+(kaun|kon)\s+hai/i,
      /who\s+(owns|runs)\s+kiaan/i,
      /kiaan\s*technology\s*(kya\s+hai|ke\s+baare\s+mein|about)/i,
      /about\s+kiaan\s*technology/i
    ];

    if (directPatterns.some((pattern) => pattern.test(p))) {
      return true;
    }

    // 2. Multi-keyword semantic combinations (e.g. "tumhe kisne create kiya", "who built this ai")
    const mentionsCreator = /\b(creator|developer|founder|maker|owner|created|made|built|banaya|create\s*kiya|developer|develop)\b/i.test(p);
    const mentionsEntity = /\b(you|kiaan|kiaan\s*ai|bot|chatbot|ai|tumhe|tujhe|aapko)\b/i.test(p);
    const mentionsWho = /\b(who|kisne|kaun|kon|kiska|kiske)\b/i.test(p);

    if (mentionsWho && mentionsCreator && (mentionsEntity || p.length < 50)) {
      return true;
    }

    return false;
  }

  /**
   * Detects if the prompt is in Hindi, Hinglish, or Devanagari script.
   *
   * @param {string} prompt
   * @returns {boolean}
   */
  static isHindiOrHinglish(prompt = '') {
    if (!prompt) return false;
    const p = prompt.toLowerCase();
    if (/[\u0900-\u097F]/.test(p)) return true; // Devanagari Hindi
    const hindiWords = [
      'kisne', 'banaya', 'kaun', 'kon', 'tumhe', 'tujhe', 'aapko', 'hai', 'hain',
      'kya', 'baare', 'batao', 'kare', 'kaise', 'kiske', 'dwara', 'mein', 'karo'
    ];
    return hindiWords.some((w) => p.includes(w));
  }

  /**
   * Returns authoritative answer for creator queries or null if not a creator query.
   *
   * @param {string} prompt
   * @returns {string|null}
   */
  static getAnswerIfMatching(prompt = '') {
    if (!this.isCreatorQuery(prompt)) return null;

    const inHindi = this.isHindiOrHinglish(prompt);

    if (inHindi) {
      return `**Rohit Patidar 😎** ne **Kiaan AI** ko create kiya hai, jo **Kiaan Technology** company mein kaam karte hain! 🚀

---

### 🏢 Kiaan Technology ke baare mein:
🌐 **Official Website:** [https://kiaantechnology.com](https://kiaantechnology.com)

**Kiaan Technology** ek modern IT aur innovative software development company hai jo businesses aur enterprises ke liye cutting-edge digital solutions develop karti hai:

- 🤖 **Artificial Intelligence & LLMs:** Next-generation AI Chatbots, smart automated workflows, aur intelligent neural models.
- 💻 **Custom Software & Web Development:** High-speed, secure web applications, enterprise platforms aur modern UI/UX architecture.
- 📱 **Mobile App Development:** Android aur iOS ke liye high-performance native aur cross-platform mobile apps.
- ☁️ **Cloud Solutions & IT Consulting:** Scalable cloud infrastructure, DevOps pipelines, API ecosystems, aur digital transformation.

Agar aapko Kiaan Technology ki services ya digital products ke baare mein aur detail janni hai, toh aap unki official website visit kar sakte hain:
👉 **[https://kiaantechnology.com](https://kiaantechnology.com)**`;
    }

    return `**Rohit Patidar 😎** created **Kiaan AI**, who is working at **Kiaan Technology** company! 🚀

---

### 🏢 About Kiaan Technology:
🌐 **Official Website:** [https://kiaantechnology.com](https://kiaantechnology.com)

**Kiaan Technology** is a forward-thinking IT and software engineering enterprise dedicated to delivering world-class digital innovations:

- 🤖 **Artificial Intelligence & Machine Learning:** Next-generation AI Chatbots, LLM architectures, intelligent workflow automation, and predictive data systems.
- 💻 **Custom Software & Web Development:** Scalable cloud-native web architectures, robust APIs, and enterprise software solutions.
- 📱 **Mobile App Development:** High-performance iOS and Android applications designed for seamless speed and exceptional UI/UX.
- ☁️ **Cloud Infrastructure & IT Consulting:** Enterprise cloud architectures, DevOps pipelines, cybersecurity, and digital transformation.

To learn more about Kiaan Technology's products, services, or business collaborations, visit their official website:
👉 **[https://kiaantechnology.com](https://kiaantechnology.com)**`;
  }
}

