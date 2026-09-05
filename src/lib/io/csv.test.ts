import { makeCard } from '@/test/factories';
import { CSV_HEADERS, parseCsv, stripBom, toCsv } from './csv';

const PRD_CSV = `traditional,pinyin,definition,domain,tags,example_sentence,foils
滷肉飯,lǔ ròu fàn,Braised pork rice,food,night-market|staple,台灣的滷肉飯每一家做法都不太一樣。,魯|鱸
團契,tuán qì,Church fellowship,church,evangelical|youth,我們教會每週五晚上有青年團契。,團隊|契合
傲嬌,ào jiāo,Tsundere (anime archetype),anime,acgn|archetype,她明明很關心你卻裝作不在乎，真是傲嬌。,驕傲|傲慢
傻眼,shǎ yǎn,Stunned / facepalm,slang,colloquial,聽到這個離譜的消息，大家都傻眼了。,白眼|眨眼
`;

describe('parseCsv', () => {
  it('parses the PRD §7.2 sample without corruption', () => {
    const { rows, issues } = parseCsv(PRD_CSV);
    expect(issues).toEqual([]);
    expect(rows).toHaveLength(4);
    expect(rows[0]).toMatchObject({
      traditional: '滷肉飯',
      pinyin: 'lǔ ròu fàn',
      definition: 'Braised pork rice',
      domain: 'food',
      tags: ['night-market', 'staple'],
      exampleSentenceTraditional: '台灣的滷肉飯每一家做法都不太一樣。',
      visualFoils: ['魯', '鱸'],
      sourceIndex: 2,
    });
    expect(rows[3].domain).toBe('slang');
    expect(rows[2].exampleSentenceTraditional).toContain('，');
  });

  it('strips a UTF-8 BOM, tolerates CRLF, quoted commas and header aliases', () => {
    const text =
      '﻿Hanzi,Pinyin,Meaning,Category,Tags\r\n"火鍋","huo3 guo1","Hot pot, shared","飲食","winter"\r\n';
    const { rows, issues } = parseCsv(text);
    expect(issues).toEqual([]);
    expect(rows[0]).toMatchObject({
      traditional: '火鍋',
      pinyin: 'huǒ guō',
      definition: 'Hot pot, shared',
      domain: 'food',
      tags: ['winter'],
    });
  });

  it('reports unknown domains, missing pinyin and empty rows as warnings/issues', () => {
    const text = 'traditional,pinyin,definition,domain\n火鍋,,Hot pot,kitchen\n,x,y,food\n';
    const { rows, issues } = parseCsv(text);
    expect(rows).toHaveLength(1);
    expect(rows[0].domain).toBeUndefined();
    expect(rows[0].warnings.join(' ')).toMatch(/Unknown domain "kitchen"/);
    expect(rows[0].warnings.join(' ')).toMatch(/No pinyin/);
    expect(issues).toHaveLength(1);
    expect(issues[0].row).toBe(3);
  });

  it('fails clearly without a traditional column or on empty input', () => {
    expect(parseCsv('').issues[0].message).toMatch(/empty/);
    const { rows, issues } = parseCsv('word_zh,pinyin\n火鍋,huǒ guō\n');
    expect(rows).toEqual([]);
    expect(issues[0].message).toMatch(/Missing required "traditional" column/);
  });
});

describe('toCsv', () => {
  it('round-trips cards through CSV with a BOM and the PRD header order', () => {
    const cards = [
      makeCard({
        traditional: '滷肉飯',
        tags: ['night-market', 'staple'],
        visualFoils: ['魯', '鱸'],
      }),
      makeCard({
        traditional: '傻眼',
        pinyin: 'shǎ yǎn',
        definition: 'Stunned, "facepalm"',
        domain: 'slang',
        tags: [],
        exampleSentenceTraditional: '聽到這個離譜的消息，大家都傻眼了。',
        exampleSentencePinyin: undefined,
        exampleSentenceTranslation: undefined,
        visualFoils: undefined,
      }),
    ];
    const csv = toCsv(cards);
    expect(csv.startsWith('﻿')).toBe(true);
    expect(stripBom(csv).split('\n')[0]).toBe(CSV_HEADERS.join(','));
    const { rows, issues } = parseCsv(csv);
    expect(issues).toEqual([]);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      traditional: '滷肉飯',
      pinyin: 'lǔ ròu fàn',
      tags: ['night-market', 'staple'],
      visualFoils: ['魯', '鱸'],
      exampleSentencePinyin: cards[0].exampleSentencePinyin,
      exampleSentenceTranslation: cards[0].exampleSentenceTranslation,
    });
    expect(rows[1]).toMatchObject({
      traditional: '傻眼',
      definition: 'Stunned, "facepalm"',
      domain: 'slang',
      tags: [],
      visualFoils: [],
    });
    expect(rows[1].exampleSentencePinyin).toBeUndefined();
  });
});
