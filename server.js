const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = 3000;

app.use(cors());

// The complete album collection exceeds the default 100 KB limit.
app.use(express.json({ limit: '10mb' }));

app.use(express.static(__dirname));

const DATA_FILE = path.join(__dirname, 'data.json');

if (!fs.existsSync(DATA_FILE)) {
  const defaultData = [
    {
      id: 'cat_wisdom',
      name: 'Wisdom Grove',
      themeColor: '#2E7D64',
      fontColor: '#FFFFFF',
      font: "'Playfair Display', serif",
      cards: [
        {
          id: 'c1',
          text: 'The mind is everything. What you think you become. – Buddha'
        },
        {
          id: 'c2',
          text: 'Knowing yourself is the beginning of all wisdom. – Aristotle'
        },
        {
          id: 'c3',
          text: 'The only true wisdom is in knowing you know nothing. – Socrates'
        },
        {
          id: 'c4',
          text: 'Simplicity is the ultimate sophistication. – Leonardo da Vinci'
        },
        {
          id: 'c5',
          text: 'The journey of a thousand miles begins with one step. – Lao Tzu'
        }
      ]
    },
    {
      id: 'cat_love',
      name: 'Heartfelt',
      themeColor: '#D45A7A',
      fontColor: '#FFFFFF',
      font: "'Dancing Script', cursive",
      cards: [
        {
          id: 'c6',
          text: 'Where there is love, there is life. – Gandhi'
        },
        {
          id: 'c7',
          text: 'Love all, trust a few. – Shakespeare'
        },
        {
          id: 'c8',
          text: 'The best thing to hold onto in life is each other. – Audrey Hepburn'
        },
        {
          id: 'c9',
          text: 'Love recognizes no barriers. – Maya Angelou'
        },
        {
          id: 'c10',
          text: 'To love and be loved is to feel the sun from both sides. – David Viscott'
        }
      ]
    },
    {
      id: 'cat_courage',
      name: 'Courage and Strength',
      themeColor: '#E67E22',
      fontColor: '#FFFFFF',
      font: "'Montserrat', sans-serif",
      cards: [
        {
          id: 'c11',
          text: 'Courage is not the absence of fear, but the triumph over it. – Nelson Mandela'
        },
        {
          id: 'c12',
          text: 'You gain strength, courage, and confidence by every experience. – Eleanor Roosevelt'
        },
        {
          id: 'c13',
          text: 'Be strong and courageous. Do not be afraid. – Joshua 1:9'
        },
        {
          id: 'c14',
          text: 'Fortitude is the guard and support of the other virtues. – John Locke'
        },
        {
          id: 'c15',
          text: 'Success is not final, failure is not fatal: it is the courage to continue that counts. – Winston Churchill'
        }
      ]
    },
    {
      id: 'cat_dreams',
      name: 'Dreams and Ambition',
      themeColor: '#3498DB',
      fontColor: '#FFFFFF',
      font: "'Poppins', sans-serif",
      cards: [
        {
          id: 'c16',
          text: 'All our dreams can come true if we have the courage to pursue them. – Walt Disney'
        },
        {
          id: 'c17',
          text: "Don't watch the clock; do what it does. Keep going. – Sam Levenson"
        },
        {
          id: 'c18',
          text: 'The future belongs to those who believe in the beauty of their dreams. – Eleanor Roosevelt'
        },
        {
          id: 'c19',
          text: 'Dream big and dare to fail. – Norman Vaughan'
        },
        {
          id: 'c20',
          text: 'The only limit to our realization of tomorrow is our doubts of today. – Franklin D. Roosevelt'
        }
      ]
    },
    {
      id: 'cat_gratitude',
      name: 'Gratitude',
      themeColor: '#27AE60',
      fontColor: '#FFFFFF',
      font: "'Cormorant Garamond', serif",
      cards: [
        {
          id: 'c21',
          text: 'Gratitude turns what we have into enough. – Aesop'
        },
        {
          id: 'c22',
          text: "Be thankful for what you have; you'll end up having more. – Oprah Winfrey"
        },
        {
          id: 'c23',
          text: 'Gratitude is the fairest blossom which springs from the soul. – Henry Ward Beecher'
        },
        {
          id: 'c24',
          text: 'Enjoy the little things, for one day you may look back and realize they were the big things. – Robert Brault'
        }
      ]
    },
    {
      id: 'cat_creativity',
      name: 'Creativity',
      themeColor: '#9B59B6',
      fontColor: '#FFFFFF',
      font: "'Raleway', sans-serif",
      cards: [
        {
          id: 'c25',
          text: 'Every child is an artist. The problem is how to remain an artist once we grow up. – Pablo Picasso'
        },
        {
          id: 'c26',
          text: 'Creativity takes courage. – Henri Matisse'
        },
        {
          id: 'c27',
          text: 'Art washes away from the soul the dust of everyday life. – Pablo Picasso'
        },
        {
          id: 'c28',
          text: 'The creative adult is the child who survived. – Ursula K. Le Guin'
        },
        {
          id: 'c29',
          text: "You can't use up creativity. The more you use, the more you have. – Maya Angelou"
        }
      ]
    }
  ];

  fs.writeFileSync(DATA_FILE, JSON.stringify(defaultData, null, 2));
}

app.get('/api/categories', (req, res) => {
  try {
    const data = fs.readFileSync(DATA_FILE, 'utf8');
    const categories = JSON.parse(data);

    res.json(categories);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to read data'
    });
  }
});

app.post('/api/categories', (req, res) => {
  try {
    const categories = req.body;

    if (!Array.isArray(categories)) {
      return res.status(400).json({
        error: 'Categories must be an array'
      });
    }

    // Finish writing the new data before replacing the existing file.
    const temporaryFile = DATA_FILE + '.tmp';

    fs.writeFileSync(
      temporaryFile,
      JSON.stringify(categories, null, 2)
    );

    fs.renameSync(temporaryFile, DATA_FILE);

    res.json({
      success: true,
      message: 'Data saved successfully'
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to save data'
    });
  }
});

app.use((error, req, res, next) => {
  if (error.type === 'entity.too.large') {
    return res.status(413).json({
      error: 'Album data exceeds the 10 MB save limit'
    });
  }

  if (error.type === 'entity.parse.failed') {
    return res.status(400).json({
      error: 'Invalid JSON data'
    });
  }

  next(error);
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(
    'Al-in-Bum server running at http://localhost:' + PORT
  );

  console.log('Data stored in: ' + DATA_FILE);
});