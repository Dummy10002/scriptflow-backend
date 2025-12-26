import { generateScript } from './services/scriptGenerator';
import { logger } from './utils/logger';

async function testIntegratedGenerator() {
    console.log("--- TEST 1: NO HINTS + NON-ENGLISH TRANSCRIPT ---");
    // This should detect the language but ROMANIZE it anyway because of our new global rule.
    const result1 = await generateScript({
        userIdea: "Benefits of sleep",
        transcript: "Sleep mado benefits gottu, so neevu everyday 8 hours nidde madabeku.", // Hinglish/Kannada mix
        toneHint: "" as any, // Testing empty string
        languageHint: "" as any
    });
    console.log("Result 1 (Should be Romanized):\n", result1);

    console.log("\n--- TEST 2: INFERRED HINTS FROM IDEA ---");
    // This should pick up "Hinglish" from the idea even though languageHint is empty.
    const result2 = await generateScript({
        userIdea: "Explain stock market in Hinglish mix",
        transcript: "Let's talk about stocks.",
        toneHint: undefined,
        languageHint: undefined
    });
    console.log("Result 2 (Should use Hinglish mix):\n", result2);
}

testIntegratedGenerator().catch(console.error);
