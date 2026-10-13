// Starter cookbooks shown the first time someone opens the site.
const STARTER_COOKBOOKS = [
  {
    id: 'starter-family',
    name: 'Family',
    emoji: '👨‍👩‍👧',
    recipes: [
      {
        id: 'starter-shakshuka',
        title: 'Classic Shakshuka',
        author: 'Mom',
        emoji: '🍳',
        time: 25,
        servings: 3,
        tags: ['Breakfast', 'Vegetarian'],
        ingredients: [
          '2 tbsp olive oil',
          '1 onion, chopped',
          '1 red pepper, sliced',
          '3 garlic cloves',
          '1 can crushed tomatoes',
          '1 tsp paprika',
          '1 tsp cumin',
          '5 eggs',
          'Salt and fresh parsley'
        ],
        steps: [
          'Fry the onion and pepper in olive oil until soft.',
          'Add garlic, paprika and cumin and cook for 1 minute.',
          'Pour in the tomatoes and simmer for 10 minutes.',
          'Make small wells in the sauce and crack the eggs into them.',
          'Cover and cook until the egg whites are set. Top with parsley.'
        ]
      },
      {
        id: 'starter-soup',
        title: 'Cozy Lentil Soup',
        author: 'Grandpa',
        emoji: '🍲',
        time: 40,
        servings: 6,
        tags: ['Dinner', 'Vegan'],
        ingredients: [
          '1 cup red lentils',
          '1 onion',
          '2 carrots',
          '2 celery sticks',
          '1 tsp cumin',
          '6 cups vegetable stock',
          'Lemon juice'
        ],
        steps: [
          'Chop the onion, carrots and celery and fry until soft.',
          'Add the cumin, lentils and stock.',
          'Simmer for 25 minutes until the lentils are soft.',
          'Blend half of the soup for a creamy texture.',
          'Finish with a squeeze of lemon.'
        ]
      },
      {
        id: 'starter-pancakes',
        title: 'Banana Pancakes',
        author: 'Tamar',
        emoji: '🥞',
        time: 15,
        servings: 2,
        tags: ['Breakfast', 'Quick'],
        ingredients: [
          '2 ripe bananas',
          '2 eggs',
          '1/2 cup flour',
          '1 tsp baking powder',
          'Butter for the pan',
          'Honey or maple syrup'
        ],
        steps: [
          'Mash the bananas with a fork.',
          'Whisk in the eggs, flour and baking powder.',
          'Cook small pancakes in a buttered pan, 2 minutes per side.',
          'Serve with honey or maple syrup.'
        ]
      }
    ]
  },
  {
    id: 'starter-uni',
    name: 'Uni Friends',
    emoji: '🎓',
    recipes: [
      {
        id: 'starter-pasta',
        title: 'Quick Tomato Basil Pasta',
        author: 'Yossi',
        emoji: '🍝',
        time: 20,
        servings: 4,
        tags: ['Dinner', 'Vegetarian'],
        ingredients: [
          '400 g spaghetti',
          '3 tbsp olive oil',
          '4 garlic cloves, sliced',
          '400 g cherry tomatoes',
          'A handful of fresh basil',
          'Parmesan cheese'
        ],
        steps: [
          'Cook the pasta in salted water.',
          'Meanwhile, fry the garlic in olive oil for 1 minute.',
          'Add the cherry tomatoes and cook until they burst.',
          'Toss the pasta with the sauce and basil.',
          'Serve with grated parmesan.'
        ]
      },
      {
        id: 'starter-cookies',
        title: 'Chewy Chocolate Chip Cookies',
        author: 'Maya',
        emoji: '🍪',
        time: 30,
        servings: 20,
        tags: ['Dessert', 'Baking'],
        ingredients: [
          '120 g soft butter',
          '1 cup brown sugar',
          '1 egg',
          '1 tsp vanilla',
          '1.5 cups flour',
          '1/2 tsp baking soda',
          '1 cup chocolate chips'
        ],
        steps: [
          'Preheat the oven to 180°C.',
          'Beat the butter and sugar, then add the egg and vanilla.',
          'Mix in the flour and baking soda, then the chocolate chips.',
          'Scoop balls onto a tray lined with baking paper.',
          'Bake for 10–12 minutes. They harden as they cool.'
        ]
      },
      {
        id: 'starter-salad',
        title: 'Fresh Greek Salad',
        author: 'Daniel',
        emoji: '🥗',
        time: 10,
        servings: 2,
        tags: ['Lunch', 'Vegetarian', 'Quick'],
        ingredients: [
          '2 tomatoes',
          '1 cucumber',
          '1/2 red onion',
          'A handful of olives',
          '100 g feta cheese',
          'Olive oil, oregano, salt'
        ],
        steps: [
          'Cut the vegetables into large pieces.',
          'Add the olives and crumble the feta on top.',
          'Drizzle with olive oil and sprinkle with oregano and salt.'
        ]
      }
    ]
  }
];
