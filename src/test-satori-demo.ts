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
    { type: 'visual', content: 'Close-up of laptop screen with code' },
    { type: 'say', content: 'Stop wasting hours on repetitive tasks!' },
  ],
  body: [
    { type: 'visual', content: 'Split screen: Before vs After comparison' },
    { type: 'say', content: 'This one simple automation saved me 10 hours every week.' },
    { type: 'visual', content: 'Show hands-free workflow running' },
    { type: 'say', content: 'And the best part? It runs completely on autopilot.' },
  ],
  cta: [
    { type: 'visual', content: 'Point at screen with results dashboard' },
    { type: 'say', content: 'Follow for more productivity hacks that actually work!' },
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
