// Ingredient icons: one path each on a 24×24 grid, stroked in currentColor like Icon.tsx.
// Each icon lists the ingredient names it stands for; ingredientIcon() picks one for a recipe line.

// Kinds of ingredient, in the order the "By type" view lists them. Anything without an icon is "Other".
export const INGREDIENT_GROUPS = {
  produce: 'Fruit and veg',
  protein: 'Meat, fish and eggs',
  dairy: 'Dairy',
  seasoning: 'Herbs and spices',
  pantry: 'Pantry',
  liquid: 'Oils, sauces and liquids',
  other: 'Other',
} as const

export type IngredientGroup = keyof typeof INGREDIENT_GROUPS

export const INGREDIENT_ICONS = {
  poultry: {
    group: 'protein',
    d: 'M10.4 13.6C8.6 11.3 9.3 6.6 12.4 4.7c3.1-1.9 7.4-.6 8.3 2.9.9 3.5-1.5 7.4-5.4 7.6-1.8.1-3.5-.4-4.9-1.6ZM10.4 13.6 6.6 17.4M3.8 17a1.4 1.4 0 1 0 2.8 0 1.4 1.4 0 1 0-2.8 0ZM5.6 18.8a1.4 1.4 0 1 0 2.8 0 1.4 1.4 0 1 0-2.8 0Z',
    keywords: ['chicken', 'turkey', 'duck', 'poultry', 'drumstick', 'quail', 'goose'],
  },
  steak: {
    group: 'protein',
    d: 'M4 11c0-4 3.6-7 8.3-7C17 4 21 6.8 21 11c0 4.4-3.7 6-6.5 7.3-2.4 1.1-3.5 2.7-6.3 2.7C5.5 21 4 18.8 4 16.5ZM14.5 9a2 2 0 1 0 0 4 2 2 0 0 0 0-4ZM8 9.5c.5 2 2 3.5 3.5 4.5',
    keywords: ['beef', 'steak', 'lamb', 'veal', 'mince', 'brisket', 'venison', 'mutton', 'short ribs', 'ground beef'],
  },
  bacon: {
    group: 'protein',
    d: 'M3 8.5q2.25-3 4.5 0t4.5 0 4.5 0 4.5 0v6q-2.25 3-4.5 0t-4.5 0-4.5 0-4.5 0ZM3 11.5q2.25-3 4.5 0t4.5 0 4.5 0 4.5 0',
    keywords: ['bacon', 'pancetta', 'prosciutto', 'ham', 'pork', 'guanciale', 'pork belly', 'lardons'],
  },
  sausage: {
    group: 'protein',
    d: 'M3.5 11a2.25 2.25 0 0 1 4.5 0 4 4 0 0 0 8 0 2.25 2.25 0 0 1 4.5 0 8.25 8.25 0 0 1-17 0ZM5.75 8.75V7M18.25 8.75V7',
    keywords: ['sausage', 'chorizo', 'salami', 'frankfurter', 'hot dog', 'bratwurst', 'kielbasa', 'pepperoni'],
  },
  fish: {
    group: 'protein',
    d: 'M21 12c-1.8-3.6-4.8-6-8.5-6S6.8 8.4 5 12c1.8 3.6 4.8 6 7.5 6s6.7-2.4 8.5-6ZM5 12 2.5 8.5v7ZM16.5 10.5v.01M10 9c1 2 1 4 0 6',
    keywords: [
      'fish',
      'salmon',
      'tuna',
      'cod',
      'anchovy',
      'anchovies',
      'sardine',
      'haddock',
      'trout',
      'mackerel',
      'halibut',
      'sea bass',
      'snapper',
      'tilapia',
      'fish fillet',
    ],
  },
  shrimp: {
    group: 'protein',
    d: 'M16.1 5.9A8 8 0 1 0 15 18.9l4.5 1.1-1.7-4.8-5-.2A3.5 3.5 0 1 1 13.3 9.3Q19 9 16.1 5.9ZM3 12h4.5M5.3 17.7l3.2-3.2M5.3 6.3l3.2 3.2M11 4v4.5M15.6 7.8h.01M17.8 6.6c1.4-1 2.8-1.4 4.2-1.3M18.2 8c1.4-.2 2.6.1 3.8.8',
    keywords: [
      'shrimp',
      'prawn',
      'lobster',
      'crab',
      'scallop',
      'mussel',
      'clam',
      'oyster',
      'seafood',
      'langoustine',
      'squid',
      'octopus',
      'calamari',
    ],
  },
  egg: {
    group: 'protein',
    d: 'M12 3c3.6 0 6.5 5.4 6.5 10.2a6.5 6.5 0 0 1-13 0C5.5 8.4 8.4 3 12 3Z',
    keywords: ['egg', 'egg yolk', 'egg white', 'yolk'],
  },
  tofu: {
    group: 'protein',
    d: 'M12 3l8 4.5v9L12 21l-8-4.5v-9ZM4 7.5 12 12l8-4.5M12 12v9M8 5.25l8 4.5v9',
    keywords: ['tofu', 'tempeh', 'paneer', 'seitan', 'bean curd', 'silken tofu', 'firm tofu'],
  },
  milk: {
    group: 'dairy',
    d: 'M7 9.5 9 5.5h6l2 4V20a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1ZM7 9.5h10M9 5.5V3h6v2.5M7 14h10',
    keywords: ['milk', 'buttermilk', 'half and half', 'whole milk', 'oat milk', 'almond milk', 'soy milk'],
  },
  cheese: {
    group: 'dairy',
    d: 'M3 14.5 17 6.5l4 3v9.5H3ZM3 14.5h18M8 17a1 1 0 1 0 2 0 1 1 0 1 0-2 0ZM14 16.5a1 1 0 1 0 2 0 1 1 0 1 0-2 0ZM15.5 11a1 1 0 1 0 2 0 1 1 0 1 0-2 0Z',
    keywords: [
      'cheese',
      'parmesan',
      'parmigiano',
      'cheddar',
      'mozzarella',
      'feta',
      'ricotta',
      'gruyere',
      'pecorino',
      'halloumi',
      'goat cheese',
      'brie',
      'gouda',
      'cream cheese',
      'burrata',
    ],
  },
  butter: {
    group: 'dairy',
    d: 'M3 12.5 8 8.5h13v6l-5 4H3ZM3 12.5h13l5-4M16 12.5v6M6 10.5h3',
    keywords: ['butter', 'unsalted butter', 'salted butter', 'ghee', 'margarine'],
  },
  yogurt: {
    group: 'dairy',
    d: 'M4 8.5C4 7.1 7.6 6 12 6s8 1.1 8 2.5S16.4 11 12 11 4 9.9 4 8.5ZM4 8.5l1.5 10.5c.2 1.2 3 2 6.5 2s6.3-.8 6.5-2L20 8.5M14.5 6.1 18 3l2.5 2.5-1.6 1.8',
    keywords: [
      'yogurt',
      'yoghurt',
      'cream',
      'sour cream',
      'creme fraiche',
      'mascarpone',
      'double cream',
      'heavy cream',
      'whipping cream',
      'single cream',
      'quark',
      'skyr',
      'labneh',
    ],
  },
  tomato: {
    group: 'produce',
    d: 'M12 8c-4.6 0-8 2.6-8 6.4C4 18.2 7.6 21 12 21s8-2.8 8-6.6C20 10.6 16.6 8 12 8ZM12 8V4.5M12 8 8.5 6.5M12 8l3.5-1.5M12 8l-1.8 2.8M12 8l1.8 2.8',
    keywords: ['tomato', 'cherry tomato', 'plum tomato', 'passata', 'tomato paste', 'tomato puree', 'sun dried tomato'],
  },
  onion: {
    group: 'produce',
    d: 'M12 5.5C8 8 4.5 10 4.5 14a7.5 6.5 0 0 0 15 0c0-4-3.5-6-7.5-8.5ZM8 14.5c0-3 1.7-5.5 4-7.5M16 14.5c0-3-1.7-5.5-4-7.5M12 5.5c-.4-1.2-.4-2.3 0-3.5M12 5.5c.8-1.2 2-1.8 3.5-1.8M10 20.5l-.5 1.5M12 20.5V22M14 20.5l.5 1.5',
    keywords: ['onion', 'shallot', 'leek', 'spring onion', 'scallion', 'red onion', 'green onion'],
  },
  garlic: {
    group: 'produce',
    d: 'M12 3c0 3-7 5-7 10.5 0 4 3.1 6.5 7 6.5s7-2.5 7-6.5C19 8 12 6 12 3ZM12 9.5c-1.8 2-2.8 4.2-2.8 6.5 0 1.7.9 3 2.8 4M12 9.5c1.8 2 2.8 4.2 2.8 6.5 0 1.7-.9 3-2.8 4M12 9.5V20M9.5 21.5h5',
    keywords: ['garlic', 'garlic clove', 'minced garlic'],
  },
  chilli: {
    group: 'produce',
    d: 'M15.5 7C14 13 9.5 17 4 19c7.5 1.5 15.5-3.5 15.5-10 0-1.6-1.4-2.6-4-2ZM17.6 6.6c0-1.7.7-3 2.4-3.6',
    keywords: [
      'chilli',
      'chili',
      'chile',
      'jalapeno',
      'habanero',
      'serrano',
      'bird eye chilli',
      'scotch bonnet',
      'green chilli',
      'red chilli',
    ],
  },
  carrot: {
    group: 'produce',
    d: 'M14 7.5c2-1 4 .5 4 2.5 0 1.3-1.2 2.6-3 4.4L5 21c-1.2.5-2.2-.5-1.6-1.6L11 9.5c1-1 1.9-1.6 3-2ZM16 7l3-3M17.5 8.5 21 7M15.5 6 15 3M9.5 12.5 11 14M7 16l1.5 1.5',
    keywords: ['carrot', 'parsnip', 'turnip', 'radish', 'beetroot', 'beet'],
  },
  potato: {
    group: 'produce',
    d: 'M6 8.5C8 5 14 4 17.5 6S21 12 19 15.5 13 21 8.5 19.5 3 15 3.8 12.5c.4-1.4 1.2-2.6 2.2-4ZM9 10h.01M14 9h.01M11.5 15h.01M16 13.5h.01',
    keywords: ['potato', 'sweet potato', 'yam', 'new potato'],
  },
  mushroom: {
    group: 'produce',
    d: 'M3.5 12a8.5 7.5 0 0 1 17 0ZM9 12v6.5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2V12M9.5 8h.01M14.5 7h.01',
    keywords: ['mushroom', 'shiitake', 'porcini', 'chestnut mushroom', 'portobello', 'oyster mushroom', 'chanterelle'],
  },
  leaf: {
    group: 'produce',
    d: 'M4.5 19.5C3.5 11 9 4.5 19.5 4.5c0 10.5-6.5 16-15 15ZM4.5 19.5 13 11M9 15.5l4.5-.2M11.5 12.5l.2-4',
    keywords: [
      'lettuce',
      'spinach',
      'kale',
      'cabbage',
      'chard',
      'rocket',
      'arugula',
      'greens',
      'bok choy',
      'pak choi',
      'salad leaves',
      'watercress',
      'collard',
      'nori',
      'seaweed',
    ],
  },
  'bell-pepper': {
    group: 'produce',
    d: 'M12 7c-2-1.5-7-1.2-7 4.5 0 5.5 2.5 9.5 5 9.5 1 0 1.3-.7 2-.7s1 .7 2 .7c2.5 0 5-4 5-9.5C19 5.8 14 5.5 12 7ZM12 7c0-2 .8-3.5 2.5-4M12 10v8',
    keywords: [
      'bell pepper',
      'capsicum',
      'red pepper',
      'green pepper',
      'yellow pepper',
      'sweet pepper',
      'roasted pepper',
    ],
  },
  broccoli: {
    group: 'produce',
    d: 'M7.5 13.5a3 3 0 0 1-.6-5.9 3.5 3.5 0 0 1 6.6-1.8 3.2 3.2 0 0 1 4.3 2.4 2.8 2.8 0 0 1-.8 5.3ZM10 13.5l.5 7.5h3l.5-7.5M12 13.5v3.5',
    keywords: ['broccoli', 'cauliflower', 'broccolini', 'tenderstem'],
  },
  squash: {
    group: 'produce',
    d: 'M4.4 15.4 15.4 4.4a3 3 0 0 1 4.2 4.2L8.6 19.6a3 3 0 0 1-4.2-4.2ZM19 5l2-2M7.5 14 11 10.5M11.5 15 15 11.5',
    keywords: [
      'zucchini',
      'courgette',
      'cucumber',
      'squash',
      'butternut squash',
      'pumpkin',
      'marrow',
      'eggplant',
      'aubergine',
      'gourd',
    ],
  },
  corn: {
    group: 'produce',
    d: 'M12 3c2.2 0 3.5 3.5 3.5 8s-1.3 9-3.5 9-3.5-4.5-3.5-9S9.8 3 12 3ZM8.7 8h6.6M8.6 12h6.8M9.2 16h5.6M12 3v17M12 21c-3-1-6-4-7-9 2.5 1 4.2 3 5 5.5M12 21c3-1 6-4 7-9-2.5 1-4.2 3-5 5.5',
    keywords: ['corn', 'sweetcorn', 'corn on the cob', 'corn kernel', 'ears of corn', 'baby corn'],
  },
  celery: {
    group: 'produce',
    d: 'M8.5 21h7l-1-10.5h-5ZM11 10.5V21M13 10.5V21M9.5 10.5C7.5 10 6.5 8 7 6c1.5-.2 2.8.5 3.5 1.5.3-2 1.3-3.5 3-4 1.3 1.3 1.6 3 1 4.5 1-.8 2.4-1 3.5-.5.2 2-1 3.5-3.5 3.5',
    keywords: ['celery', 'celery stick', 'asparagus', 'fennel', 'rhubarb', 'lemongrass stalk'],
  },
  citrus: {
    group: 'produce',
    d: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18ZM12 6.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM12 6.5v11M7.2 9.25l9.6 5.5M7.2 14.75l9.6-5.5',
    keywords: [
      'lemon',
      'lime',
      'orange',
      'grapefruit',
      'zest',
      'lemon juice',
      'lime juice',
      'clementine',
      'mandarin',
      'yuzu',
    ],
  },
  apple: {
    group: 'produce',
    d: 'M12 7.5c-1.5-1-5.5-1.5-7 2C3.4 13 6 21 9.5 21c1.2 0 1.5-.6 2.5-.6s1.3.6 2.5.6C18 21 20.6 13 19 9.5c-1.5-3.5-5.5-3-7-2ZM12 7.5c0-2 .5-3.5 2-4.5M12 6C11 4.5 9.5 4 8 4.3c.3 1.5 2 2.3 4 1.7',
    keywords: ['apple', 'pear', 'quince', 'apple cider'],
  },
  berry: {
    group: 'produce',
    d: 'M12 7c-4.5-1-8 1-8 4.5C4 16 9 21 12 21s8-5 8-9.5C20 8 16.5 6 12 7ZM12 7 9 4.5M12 7l3-2.5M12 7V3.5M9 11h.01M15 11h.01M12 13.5h.01M9.5 16.5h.01M14.5 16.5h.01',
    keywords: [
      'strawberry',
      'strawberries',
      'raspberry',
      'raspberries',
      'blueberry',
      'blueberries',
      'blackberry',
      'blackberries',
      'berries',
      'cherry',
      'cherries',
      'cranberry',
      'cranberries',
    ],
  },
  olive: {
    group: 'produce',
    d: 'M5.5 15.5a3.5 4.5 0 1 0 7 0 3.5 4.5 0 1 0-7 0ZM9 11C9 7.5 11 4.8 14 3.8M14 3.8c2.5 0 4.5 1 5.5 3-2.5.6-4.6-.1-5.5-3ZM9 14v.01',
    keywords: ['olive', 'kalamata', 'green olive', 'black olive', 'caper'],
  },
  avocado: {
    group: 'produce',
    d: 'M12 3c-2.5 0-4 2.5-4.5 5.5C7 11 5 12.5 5 15.5a7 7 0 0 0 14 0c0-3-2-4.5-2.5-7C16 5.5 14.5 3 12 3ZM12 12.5a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z',
    keywords: ['avocado', 'guacamole'],
  },
  banana: {
    group: 'produce',
    d: 'M20 6A14 14 0 0 1 6 20c.2-1.2.5-2.2 1-3A13.4 13.4 0 0 0 17 7c1-.5 2-.8 3-1ZM18.6 6.4l.9-3',
    keywords: ['banana', 'plantain'],
  },
  herb: {
    group: 'seasoning',
    d: 'M12 21V5.5M12 9.5c-3 0-4.5-1.7-4.5-4 3 0 4.5 1.7 4.5 4Zm0 0c3 0 4.5-1.7 4.5-4-3 0-4.5 1.7-4.5 4ZM12 15c-3 0-4.5-1.7-4.5-4 3 0 4.5 1.7 4.5 4Zm0 0c3 0 4.5-1.7 4.5-4-3 0-4.5 1.7-4.5 4ZM12 5.5c0-1 .3-1.8 1-2.5',
    keywords: [
      'parsley',
      'oregano',
      'basil',
      'coriander',
      'cilantro',
      'thyme',
      'rosemary',
      'mint',
      'dill',
      'sage',
      'chives',
      'tarragon',
      'bay leaf',
      'bay leaves',
      'herbs',
      'marjoram',
      'lemongrass',
    ],
  },
  spice: {
    group: 'seasoning',
    d: 'M7 11h10v8a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2ZM7.5 11V8.5a1 1 0 0 1 1-1h7a1 1 0 0 1 1 1V11M8.5 7.5V5a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v2.5M10.5 5h.01M13.5 5h.01M12 4.5v.01M7 14.5h10',
    keywords: [
      'cumin',
      'paprika',
      'smoked paprika',
      'cinnamon',
      'nutmeg',
      'turmeric',
      'cardamom',
      'clove',
      'ground coriander',
      'coriander seed',
      'ginger',
      'cayenne',
      'allspice',
      'garam masala',
      'curry powder',
      'five spice',
      'star anise',
      'saffron',
      'vanilla',
      'spice',
      'seasoning',
      'chilli powder',
      'chili powder',
      'chilli flakes',
      'chili flakes',
      'red pepper flakes',
      'fennel seed',
      'mustard seed',
      'cream of tartar',
      'sumac',
      'za atar',
      'cayenne pepper',
      'sichuan peppercorn',
      'mustard powder',
    ],
  },
  'salt-pepper': {
    group: 'seasoning',
    d: 'M3.5 21v-8.5C3.5 9.5 5 7 7 7s3.5 2.5 3.5 5.5V21ZM5.5 7V5h3v2M13.5 21v-8.5c0-3 1.5-5.5 3.5-5.5s3.5 2.5 3.5 5.5V21ZM15.5 7V5h3v2M7 10.5v.01M16 10.5v.01M18 10.5v.01M17 12v.01M2.5 21h19',
    keywords: [
      'salt',
      'pepper',
      'black pepper',
      'sea salt',
      'kosher salt',
      'flaky salt',
      'white pepper',
      'salt and pepper',
      'peppercorn',
    ],
  },
  flour: {
    group: 'pantry',
    d: 'M7.5 7C5 9 4.5 13 5 17c.3 2.5 2 4 4 4h6c2 0 3.7-1.5 4-4 .5-4 0-8-2.5-10M7.5 7h9M8 7 7 3.5c1.5.8 3.2.8 5 0 1.8.8 3.5.8 5 0L16 7M9.5 14h5',
    keywords: [
      'flour',
      'plain flour',
      'all purpose flour',
      'self raising flour',
      'bread flour',
      'semolina',
      'cornmeal',
      'polenta',
      'masa',
    ],
  },
  sugar: {
    group: 'pantry',
    d: 'M3 12.5 7.5 10 12 12.5 16.5 10 21 12.5v5L16.5 20 12 17.5 7.5 20 3 17.5ZM3 12.5 7.5 15 12 12.5l4.5 2.5 4.5-2.5M7.5 15v5M12 12.5v5M16.5 15v5M7.5 10V5L12 2.5 16.5 5v5M7.5 5 12 7.5 16.5 5M12 7.5v5',
    keywords: [
      'sugar',
      'brown sugar',
      'caster sugar',
      'icing sugar',
      'powdered sugar',
      'granulated sugar',
      'demerara',
      'muscovado',
    ],
  },
  rice: {
    group: 'pantry',
    d: 'M3 12h18a9 7.5 0 0 1-18 0ZM5 12c0-2.8 3.1-4.8 7-4.8s7 2 7 4.8M9.5 20.5h5M14 7.2 20.5 3M16.5 8 21.5 5',
    keywords: [
      'rice',
      'basmati',
      'jasmine rice',
      'arborio',
      'risotto',
      'quinoa',
      'couscous',
      'oats',
      'barley',
      'bulgur',
      'farro',
      'millet',
    ],
  },
  pasta: {
    group: 'pantry',
    d: 'M12 12 5 7.5c-1-.6-2 .1-2 1.2v6.6c0 1.1 1 1.8 2 1.2L12 12l7 4.5c1 .6 2-.1 2-1.2V8.7c0-1.1-1-1.8-2-1.2ZM10.5 11v2M13.5 11v2',
    keywords: [
      'pasta',
      'spaghetti',
      'penne',
      'linguine',
      'fettuccine',
      'macaroni',
      'noodle',
      'lasagne',
      'lasagna',
      'orzo',
      'farfalle',
      'rigatoni',
      'tagliatelle',
      'gnocchi',
      'ramen',
      'udon',
      'rice noodles',
    ],
  },
  bread: {
    group: 'pantry',
    d: 'M5 10.5C3.5 10 3 9 3 7.8 3 5.7 5.5 4 9 4h6c3.5 0 6 1.7 6 3.8 0 1.2-.5 2.2-2 2.7V19a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1Z',
    keywords: [
      'bread',
      'baguette',
      'bun',
      'tortilla',
      'pita',
      'breadcrumbs',
      'panko',
      'sourdough',
      'toast',
      'brioche',
      'ciabatta',
      'naan',
      'flatbread',
      'croutons',
    ],
  },
  pastry: {
    group: 'pantry',
    d: 'M5.2 14.2 14.2 5.2l4.6 4.6-9 9ZM7.5 16.5 3.5 20.5M16.5 7.5l4-4',
    keywords: [
      'pastry',
      'puff pastry',
      'filo',
      'phyllo',
      'shortcrust pastry',
      'pizza dough',
      'dough',
      'pie crust',
      'pie dough',
      'pastry case',
    ],
  },
  beans: {
    group: 'pantry',
    d: 'M8 5c3 0 4 2 5 3s2.5 1 4 1.5c2.5 1 3.5 3.2 3 5.5-.7 3-3.5 4.5-7 4-4.5-.6-9-4-9-9C4 7 5.5 5 8 5ZM8 9c.3 2 2 4 4.5 5',
    keywords: [
      'bean',
      'black bean',
      'kidney bean',
      'cannellini',
      'chickpea',
      'lentil',
      'pea',
      'edamame',
      'butter bean',
      'pinto bean',
      'split pea',
      'green bean',
    ],
  },
  nut: {
    group: 'pantry',
    d: 'M12 3c3.5 3 6 7 6 11a6 6 0 0 1-12 0c0-4 2.5-8 6-11ZM11 8c-1 2-1.5 4-1.5 6.5M14 10.5c.3 2 .2 4-.5 6',
    keywords: [
      'nut',
      'almond',
      'walnut',
      'pecan',
      'cashew',
      'pistachio',
      'hazelnut',
      'peanut',
      'pine nut',
      'peanut butter',
      'sesame',
      'sesame seed',
      'tahini',
      'pumpkin seed',
      'sunflower seed',
      'macadamia',
    ],
  },
  honey: {
    group: 'pantry',
    d: 'M6 9h12v10a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2ZM7 5.5a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1V9H7ZM6 13c2 1.5 4-1 6 0s4 1.5 6 0',
    keywords: [
      'honey',
      'maple syrup',
      'syrup',
      'jam',
      'molasses',
      'agave',
      'golden syrup',
      'treacle',
      'marmalade',
      'preserves',
    ],
  },
  jar: {
    group: 'pantry',
    d: 'M7 3.5a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1V6H7ZM7.5 6C6 7 5 8.5 5 10v9a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-9c0-1.5-1-3-2.5-4M8 12h8v5H8Z',
    keywords: [
      'miso',
      'white miso',
      'pesto',
      'harissa',
      'curry paste',
      'gochujang',
      'hummus',
      'salsa',
      'pickle',
      'kimchi',
      'cornichon',
      'chutney',
      'relish',
      'tapenade',
      'paste',
      'sauerkraut',
      'doenjang',
    ],
  },
  tin: {
    group: 'pantry',
    d: 'M6 5.5C6 4.1 8.7 3 12 3s6 1.1 6 2.5v13c0 1.4-2.7 2.5-6 2.5s-6-1.1-6-2.5ZM6 5.5C6 6.9 8.7 8 12 8s6-1.1 6-2.5M6 10.5c0 1.4 2.7 2.5 6 2.5s6-1.1 6-2.5M6 15.5c0 1.4 2.7 2.5 6 2.5s6-1.1 6-2.5',
    keywords: [
      'coconut milk',
      'coconut cream',
      'condensed milk',
      'evaporated milk',
      'baking powder',
      'baking soda',
      'bicarbonate of soda',
      'yeast',
      'cornstarch',
      'cornflour',
      'gelatine',
      'gelatin',
    ],
  },
  chocolate: {
    group: 'pantry',
    d: 'M6 3h12a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1ZM5 9h14M5 15h14M12 3v18',
    keywords: ['chocolate', 'cocoa', 'cacao', 'dark chocolate', 'chocolate chips', 'cocoa powder'],
  },
  oil: {
    group: 'liquid',
    d: 'M10 3h4v3l2 3v10a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2V9l2-3ZM10 6h4M8 13h8M12 15.5c-.8 1-1.2 1.6-1.2 2.2a1.2 1.2 0 0 0 2.4 0c0-.6-.4-1.2-1.2-2.2Z',
    keywords: [
      'oil',
      'olive oil',
      'extra virgin olive oil',
      'vegetable oil',
      'sesame oil',
      'sunflower oil',
      'canola oil',
      'rapeseed oil',
      'coconut oil',
      'cooking spray',
    ],
  },
  sauce: {
    group: 'liquid',
    d: 'M10 2.5h4V6c2 1 3 3 3 5v8a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2v-8c0-2 1-4 3-5ZM7 13h10v5H7',
    keywords: [
      'soy sauce',
      'vinegar',
      'fish sauce',
      'worcestershire',
      'sriracha',
      'hot sauce',
      'ketchup',
      'mustard',
      'mayonnaise',
      'mayo',
      'sauce',
      'tamari',
      'mirin',
      'balsamic',
      'oyster sauce',
      'hoisin',
      'dijon',
      'coconut aminos',
    ],
  },
  wine: {
    group: 'liquid',
    d: 'M7 3h10l-.5 5a4.5 4.5 0 0 1-9 0ZM12 12.5V20M8.5 20.5h7M7.3 6.5h9.4',
    keywords: [
      'wine',
      'white wine',
      'red wine',
      'sherry',
      'beer',
      'brandy',
      'rum',
      'vermouth',
      'port',
      'sake',
      'shaoxing',
      'marsala',
      'cognac',
      'whisky',
      'whiskey',
      'vodka',
      'cider',
    ],
  },
  stock: {
    group: 'liquid',
    d: 'M4 10h16v8a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3ZM2.5 10h19M2 13h2M20 13h2M9 7.5c0-1 1-1.5 1-2.5S9 3 9 3M14 7.5c0-1 1-1.5 1-2.5S14 3 14 3',
    keywords: [
      'stock',
      'broth',
      'bouillon',
      'chicken stock',
      'beef stock',
      'vegetable stock',
      'stock cube',
      'dashi',
      'beef base',
      'chicken base',
      'stock base',
    ],
  },
  water: {
    group: 'liquid',
    d: 'M5 3h14l-1.6 16.2a2 2 0 0 1-2 1.8H8.6a2 2 0 0 1-2-1.8ZM5.7 9.5c2.1-1 4.2 1 6.3 0s4.2-1 6.3 0',
    keywords: ['water', 'sparkling water', 'soda water', 'coconut water', 'boiling water'],
  },
  ice: {
    group: 'liquid',
    d: 'M3.13 10.32 13.18 7.63l2.69 10.05-10.05 2.69ZM15.41 7.17l1.92-5.26 5.26 1.92-1.92 5.26ZM7.2 10.9l-2.1.55.57 2.13',
    keywords: ['ice', 'ice cube', 'crushed ice', 'ice cubes'],
  },
  mug: {
    group: 'liquid',
    d: 'M4 8h12v8a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5ZM16 10h1.5a2.5 2.5 0 0 1 0 5H16M8 2.5c0 1 1 1.5 1 2.5S8 6 8 6M12 2.5c0 1 1 1.5 1 2.5S12 6 12 6',
    keywords: [
      'coffee',
      'espresso',
      'tea',
      'matcha',
      'brewed coffee',
      'green tea',
      'black tea',
      'chai',
      'instant coffee',
    ],
  },
} as const satisfies Record<
  string,
  { group: Exclude<IngredientGroup, 'other'>; d: string; keywords: readonly string[] }
>

export type IngredientIconName = keyof typeof INGREDIENT_ICONS

const normalize = (text: string) =>
  text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z]+/g, ' ')
    .trim()

// Whole words only, with an optional "s" or "es" plural. Keywords are letters and spaces after
// normalizing, so the patterns stay literal and run in linear time on any input.
const MATCHERS = Object.entries(INGREDIENT_ICONS).flatMap(([name, icon]) =>
  icon.keywords.map((keyword) => {
    const text = normalize(keyword)
    return {
      name: name as IngredientIconName,
      length: text.length,
      pattern: new RegExp(`(?:^| )${text}(?:s|es)?(?= |$)`, 'g'),
    }
  }),
)

function withoutBrackets(text: string) {
  let previous
  do {
    previous = text
    text = text.replace(/\([^()]*\)/g, ' ')
  } while (text !== previous)
  return text.replace(/\(.*$/, ' ')
}

// The keyword that ends furthest right wins, because the last word names the thing
// ("chili garlic sauce" is a sauce); a longer keyword breaks ties ("peanut butter" beats "butter").
function headNoun(text: string): IngredientIconName | null {
  let best: { name: IngredientIconName; end: number; length: number } | null = null
  for (const { name, length, pattern } of MATCHERS) {
    for (const match of text.matchAll(pattern)) {
      const end = match.index + match[0].length
      if (!best || end > best.end || (end === best.end && length > best.length)) best = { name, end, length }
    }
  }
  return best?.name ?? null
}

/** The icon for an ingredient name, ignoring notes in brackets and preparation after a comma. */
export function ingredientIcon(item: string): IngredientIconName | null {
  return headNoun(normalize(withoutBrackets(item).split(',')[0])) ?? headNoun(normalize(item))
}

/** Ingredients under their kind's heading, kinds in a fixed order, recipe order kept within each. */
export function groupByType<T extends { item: string }>(items: T[]): [string, T[]][] {
  const groups = new Map<IngredientGroup, T[]>()
  for (const item of items) {
    const icon = ingredientIcon(item.item)
    const group = icon ? INGREDIENT_ICONS[icon].group : 'other'
    groups.set(group, [...(groups.get(group) ?? []), item])
  }
  return (Object.keys(INGREDIENT_GROUPS) as IngredientGroup[])
    .filter((group) => groups.has(group))
    .map((group) => [INGREDIENT_GROUPS[group], groups.get(group)!])
}
