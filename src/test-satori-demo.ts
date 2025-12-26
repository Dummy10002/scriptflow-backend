import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

// Load fonts
const poppinsRegular = readFileSync(join(__dirname, '../fonts/Poppins-Regular.ttf'));
const poppinsBold = readFileSync(join(__dirname, '../fonts/Poppins-Bold.ttf'));
const poppinsSemiBold = readFileSync(join(__dirname, '../fonts/Poppins-SemiBold.ttf'));

// Sample script data
const sampleScript = {
  hook: [
    { type: 'visual', content: 'Close-up face shot, slightly above eye level. Speaker looking directly at camera, confident posture. Text overlay appears rapidly at bottom-center: \'NINNA PRATHI DINADA YOCHANE!\'' },
    { type: 'say', content: 'Neenu eega ninn lifestyle-annu chennagi manage maadtha idiya. Ninage anasatte, ninn age-nalli iruva 90% janariginta smart idiya?' },
    { type: 'visual', content: 'Jump cut to a plain beige screen, bold red text centrally: \'Nija Helbekadre?\'' },
    { type: 'say', content: 'But, nija helbekadre, neenu next 5-10 varshad planning bagge yochane maadidiya? Illa Andre, adu ninn priority-nalli ideya?' },
    { type: 'visual', content: 'Jump cut back to speaker at desk, leans slightly forward, gestures with open hands, one palm up. Background slightly blurred, soft desk lamp visible. Text overlay appears quickly, slightly translucent: \'SHORT-TERM HUSTLE\'' },
    { type: 'say', content: 'Most jana immediate results ge sikkhaakkond bidtare. Adre nija longevity barodu neenu ee mooru principle galannu plan maadidaga.' },
  ],
  body: [
    { type: 'visual', content: 'Quick transition to a plain beige screen. Block text \'NO 1\' appears at top-left, followed by red italicized text \'Goal Mapping\' centrally. A simplified funnel graphic quickly appears on screen, showing \'VISION\' at the top, \'MISSION\' in the middle, and \'MILESTONES\' at the bottom.' },
    { type: 'say', content: 'Number one, Goal Mapping. Ninn long-term vision-annu sanna milestones agi break maadu. Just dream maadodalla, execute maadodu important.' },
    { type: 'visual', content: 'Quick transition to another plain beige screen. Black text \'NO 2\' appears at top-left, followed by red italicized text \'Resource Allocation\' centrally. A simple \'To-Do\' list graphic appears, similar to the reference, but listing: \'- Time Blocks\', \'- Skill Investment\', \'- Network Building\', \'- Capital Strategy\'.' },
    { type: 'say', content: 'Number two, Resource Allocation. Ninna time, skills, money, ee moolagalannu hege \'strategic allocation\' maadtiya anodu important.' },
    { type: 'visual', content: 'Quick transition to another plain beige screen. Black text \'NO 3\' appears at top-left, followed by red italicized text \'Adaptability Matrix\' centrally. A circular diagram appears, similar to the reference\'s skill circle, with \'PLAN A\' in the center, and arrows pointing to outer circles/boxes labelled \'CONTINGENCY\', \'ITERATION\', \'SCENARIO B\'.' },
    { type: 'say', content: 'Number three, Adaptability Matrix. Market badalagtirutte. Prati 6 months-ge ninn assumption-galannu review maadi, \'contingency plans\' ready maadko.' },
  ],
  cta: [
    { type: 'visual', content: 'Jump cut back to speaker. Speaker leans back slightly, a confident, knowing look. Background returns to a more prominent work-desk setup. Text overlay appears rapidly top-center: \'PLAN FOR UNTOUCHABILITY\'' },
    { type: 'say', content: 'Neenu eega indane ee \'long-term planning\' mindset-annu develop maadkobitta andre, next 25-30 varshada olage, neenu just competitive aagalla, literally \'untouchable\' aagtiva.' },
    { type: 'visual', content: 'Quick transition to a full screen text overlay. Bold white text on dark background, centrally aligned: \'FOLLOW FOR BLUEPRINT\'. Below it, smaller bold white text: \'COMMENT &quot;PLANTHEFUTURE&quot;.\'' },
    { type: 'say', content: 'Simply follow me and \'PLANTHEFUTURE\' antha comment maadi. Naanu ninn \'strategic blueprint\' share maadakke ready iddeeni.' },
  ],
};

// JSX-like component for a section
function Section({ title, emoji, items, isCta = false }: { title: string; emoji: string; items: { type: string; content: string }[]; isCta?: boolean }) {
  return {
    type: 'div',
    props: {
      style: {
        display: 'flex',
        flexDirection: 'column',
        marginBottom: 40,
        background: isCta 
          ? 'linear-gradient(135deg, rgba(100,255,218,0.2) 0%, rgba(100,255,218,0.05) 100%)'
          : 'rgba(255,255,255,0.05)',
        borderRadius: 16,
        padding: 30,
        border: isCta ? '2px solid rgba(100,255,218,0.5)' : 'none',
      },
      children: [
        // Section header
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              fontSize: 14,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: 3,
              color: '#64ffda',
              marginBottom: 20,
              paddingBottom: 10,
              borderBottom: '2px solid rgba(100,255,218,0.3)',
            },
            children: `${emoji} ${title}`,
          },
        },
        // Items
        ...items.map((item) => ({
          type: 'div',
          props: {
            style: {
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
              background: item.type === 'visual' ? 'rgba(100,100,100,0.2)' : 'rgba(100,255,218,0.1)',
              padding: '15px 20px',
              borderRadius: 10,
              marginBottom: 12,
              borderLeft: item.type === 'visual' ? '4px solid #888' : '4px solid #64ffda',
            },
            children: [
              // Icon
              {
                type: 'span',
                props: {
                  style: { fontSize: 20, display: 'flex' },
                  children: item.type === 'visual' ? '🎬' : '💬',
                },
              },
              // Label
              {
                type: 'span',
                props: {
                  style: {
                    display: 'flex',
                    fontSize: 12,
                    fontWeight: 700,
                    color: item.type === 'visual' ? '#aaa' : '#64ffda',
                    textTransform: 'uppercase',
                    minWidth: 60,
                  },
                  children: item.type === 'visual' ? 'VISUAL:' : 'SAY:',
                },
              },
              // Content
              {
                type: 'span',
                props: {
                  style: {
                    display: 'flex',
                    fontSize: item.type === 'visual' ? 18 : 22,
                    fontWeight: item.type === 'visual' ? 400 : 600,
                    fontStyle: item.type === 'visual' ? 'italic' : 'normal',
                    color: item.type === 'visual' ? '#ccc' : '#fff',
                    lineHeight: 1.5,
                    flex: 1,
                  },
                  children: item.content,
                },
              },
            ],
          },
        })),
      ],
    },
  };
}

async function generateDemo() {
  console.log('🎨 Generating demo image with Satori...');

  // Build the full layout
  const layout = {
    type: 'div',
    props: {
      style: {
        display: 'flex',
        flexDirection: 'column',
        width: 1080,
        padding: 60,
        fontFamily: 'Poppins',
        background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
        color: '#fff',
      },
      children: [
        Section({ title: 'HOOK', emoji: '🎯', items: sampleScript.hook }),
        Section({ title: 'BODY', emoji: '📝', items: sampleScript.body }),
        Section({ title: 'CTA', emoji: '🚀', items: sampleScript.cta, isCta: true }),
      ],
    },
  };

  // Generate SVG with Satori
  const svg = await satori(layout as any, {
    width: 1080,
    fonts: [
      { name: 'Poppins', data: poppinsRegular, weight: 400, style: 'normal' },
      { name: 'Poppins', data: poppinsSemiBold, weight: 600, style: 'normal' },
      { name: 'Poppins', data: poppinsBold, weight: 700, style: 'normal' },
    ],
  });

  console.log('✅ SVG generated, converting to PNG...');

  // Convert SVG to PNG using Resvg
  const resvg = new Resvg(svg, {
    background: 'rgba(0, 0, 0, 0)',
    fitTo: { mode: 'width', value: 1080 },
  });
  const pngData = resvg.render();
  const pngBuffer = pngData.asPng();

  // Save to file
  const outputPath = join(__dirname, '../temp/satori-demo-output.png');
  writeFileSync(outputPath, pngBuffer);

  console.log(`🖼️  Demo image saved to: ${outputPath}`);
  console.log(`📊 Image size: ${(pngBuffer.length / 1024).toFixed(2)} KB`);
}

generateDemo().catch(console.error);
