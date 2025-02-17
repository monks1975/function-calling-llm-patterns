export interface Book {
  id: string;
  name: string;
  genre: string;
  description: string;
  popularity: number;
}

export const db: Book[] = [
  {
    id: 'a1',
    name: 'To Kill a Mockingbird',
    genre: 'historical',
    description: `Compassionate, dramatic, and deeply moving, "To Kill A Mockingbird" takes readers to the roots of human behavior - to innocence and experience, kindness and cruelty, love and hatred, humor and pathos. Now with over 18 million copies in print and translated into forty languages, this regional story by a young Alabama woman claims universal appeal. Harper Lee always considered her book to be a simple love story. Today it is regarded as a masterpiece of American literature.`,
    popularity: 5,
  },
  {
    id: 'a2',
    name: 'All the Light We Cannot See',
    genre: 'historical',
    description: `In a mining town in Germany, Werner Pfennig, an orphan, grows up with his younger sister, enchanted by a crude radio they find that brings them news and stories from places they have never seen or imagined. Werner becomes an expert at building and fixing these crucial new instruments and is enlisted to use his talent to track down the resistance. Deftly interweaving the lives of Marie-Laure and Werner, Doerr illuminates the ways, against all odds, people try to be good to one another.`,
    popularity: 1,
  },
  {
    id: 'a3',
    name: "The Hitchhiker's Guide to the Galaxy",
    genre: 'funny',
    description: `Seconds before Earth is demolished to make way for a galactic freeway, Arthur Dent is plucked off the planet by his friend Ford Prefect, a researcher for the revised edition of The Hitchhiker's Guide to the Galaxy who, for the last fifteen years, has been posing as an out-of-work actor. Together, this dynamic pair begin their journey through space aboard a Vogon constructor fleet, armed with nothing more than their towels and a book inscribed with the words "Don't Panic". Featuring a galaxy full of quirky characters and absurd adventures, this beloved comedy classic follows the misadventures of the last surviving human as he tries to make sense of the universe, armed with nothing but a towel and an encyclopedic book about everything.`,
    popularity: 10,
  },
  {
    id: 'a4',
    name: 'The Great Gatsby',
    genre: 'romance',
    description: `A novel about the American Dream, love, and tragedy, "The Great Gatsby" is one of the most beloved novels of the 20th century. Fitzgerald's masterpiece is a tragic story of love and loss, set against the backdrop of the American Dream.`,
    popularity: 6,
  },
  {
    id: 'a5',
    name: 'The Catcher in the Rye',
    genre: 'romance',
    description: `A novel about the American Dream, love, and tragedy, "The Great Gatsby" is one of the most beloved novels of the 20th century. Fitzgerald's masterpiece is a tragic story of love and loss, set against the backdrop of the American Dream.`,
    popularity: 2,
  },
];

export async function list({ genre }: { genre: string }) {
  const validGenres = [
    'mystery',
    'nonfiction',
    'memoir',
    'romance',
    'historical',
    'funny',
  ];
  if (!validGenres.includes(genre)) {
    return {
      error: `Invalid genre "${genre}". Valid genres are: ${validGenres.join(
        ', '
      )}`,
    };
  }
  return db
    .filter((item) => item.genre === genre)
    .map((item) => ({
      name: item.name,
      id: item.id,
      popularity: item.popularity,
    }));
}

export async function search({ name }: { name: string }) {
  if (!name || name.trim().length === 0) {
    return {
      error: 'Please provide a non-empty search term',
    };
  }
  const results = db
    .filter((item) => item.name.toLowerCase().includes(name.toLowerCase()))
    .map((item) => ({ name: item.name, id: item.id }));

  return results.length
    ? results
    : {
        error: `No books found matching "${name}"`,
      };
}

export async function get({ id }: { id: string }) {
  const book = db.find((item) => item.id === id);
  if (!book) {
    return {
      error: `No book found with id "${id}"`,
    };
  }
  return book;
}
