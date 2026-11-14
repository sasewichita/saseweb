// Hack the Wu 2027: the facts every design shares.
// Change a fact here AND in the matching HTML (the pages keep real text so they read with JS off).
// Paths are relative to a design folder, for example designs/panorama/.

export const event = {
  name: 'Hack the Wu',
  theme: 'Year of the Goat',
  edition: 'SASE at Wichita State · 2nd annual hackathon',
  host: 'SASE at Wichita State',
  hostLong: 'The Society of Asian Scientists and Engineers (SASE) chapter at Wichita State',
  hostUrl: 'https://sasewichita.org',
  dates: 'March 26–28',
  datesLong: 'March 26–28, 2027',
  kickoff: '2027-03-26T17:00:00-05:00',
  kickoffLabel: 'March 26, 2027 at 5:00 PM CDT',
  place: 'Wichita State University, room to be announced',
  who: 'All undergrad and grad students, any major',
  tagline:
    'A beginner-friendly hackathon at Wichita State, open to every undergrad and grad student in every major.',
  note: 'Early preview. Details will change.',
};

export const links = {
  discord: 'https://discord.gg/VwQhFkzWNH',
  email: 'wichita@saseconnect.org',
  form: 'https://forms.gle/qAMZntEdfiqmrigi6',
  formEmbed:
    'https://docs.google.com/forms/d/e/1FAIpQLSffy8mhqrA2Oxq3w4JKTRhSxCev-UeuY9FiUWDqyIg_0r3Bjw/viewform?embedded=true',
  register: 'register.html',
};

export const about = {
  title: 'What Hack the Wu is',
  body: 'Teams spend a weekend building something new, from an app to a hardware project, then show it off at the end. This is our second year running it.',
  points: [
    {
      title: 'Beginner friendly',
      body: "Never been to a hackathon or written much code? You're exactly who we built this for.",
    },
    { title: 'Open to all students', body: 'Undergrad and grad students are both welcome to join.' },
    {
      title: 'Every major welcome',
      body: 'Design, business, science and engineering students all bring something a team needs.',
    },
  ],
};

export const weekend = {
  title: 'How the weekend goes',
  steps: [
    { n: '01', title: 'Team up', body: 'Teams need designers, planners and presenters as much as programmers.' },
    { n: '02', title: 'Build something new', body: 'Spend the weekend on anything from an app to a hardware project.' },
    { n: '03', title: 'Show it off', body: 'At the end, every team shows what they built.' },
  ],
};

export const details = {
  title: 'Event details',
  body: "We'll post the schedule, prizes and sign-up here as they're confirmed.",
  rows: [
    { k: 'When', v: 'March 26–28' },
    { k: 'Where', v: 'Wichita State University, room to be announced' },
    { k: 'Who', v: 'All undergrad and grad students, any major' },
    { k: 'Theme', v: 'Year of the Goat' },
  ],
};

export const lastYear = {
  kicker: 'From our first hackathon',
  title: 'Big ideas. Shared experience.',
  body: 'A look back at our first Hack the Wu: meeting teammates, building together, and sharing what we made.',
  photos: [
    { src: '../../assets/photos/hackathon-community.webp', alt: 'Hack the Wu participants gathered for a group photo', caption: 'A community of builders' },
    { src: '../../assets/photos/team-collaboration.webp', alt: 'Hackathon teammates collaborating around laptops at a table', caption: 'Ideas become team projects' },
    { src: '../../assets/photos/project-presentation.webp', alt: 'Two participants presenting their project to the audience', caption: 'A moment to share your work' },
    { src: '../../assets/photos/img-3467.webp', alt: 'Students attending a workshop in a classroom at Hack the Wu', caption: 'Learning something new, together' },
    { src: '../../assets/photos/img-6698.webp', alt: 'Hack the Wu participants presenting their project on stage', caption: 'Sharing ideas on stage' },
    { src: '../../assets/photos/img-6952.webp', alt: 'Participants receiving awards on stage at Hack the Wu', caption: 'Celebrating a weekend of building' },
    { src: '../../assets/photos/img-6329.webp', alt: 'Hack the Wu participants gathered outside Wichita State University', caption: 'The people who make it happen' },
  ],
};

export const sponsors = {
  kicker: 'The community behind the build',
  title: "Last Year's Sponsors",
  body: 'Thank you to the organizations that supported our first Hack the Wu and helped bring a weekend of ideas to life.',
  list: [
    { src: '../../assets/sponsors/ennovar.png', name: 'Ennovar at Wichita State University', w: 1008, h: 792 },
    { src: '../../assets/sponsors/atlas.png', name: 'ATLAS, Advanced Technologies Lab for Aerospace Systems', w: 479, h: 521 },
    { src: '../../assets/sponsors/summit-risk-solutions.png', name: 'Summit Risk Solutions', w: 500, h: 500 },
    { src: '../../assets/sponsors/wsu-engineering.png', name: 'Wichita State University College of Engineering', w: 932, h: 267 },
    { src: '../../assets/sponsors/mochinut.png', name: 'Mochinut', w: 527, h: 473 },
    { src: '../../assets/sponsors/humlicek-dental.png', name: 'Humlicek Dental', w: 741, h: 337 },
  ],
};

export const faq = {
  title: 'Questions',
  items: [
    {
      q: 'Do I need to know how to code?',
      a: 'No. Hack the Wu is beginner friendly, and teams need designers, planners and presenters as much as programmers.',
    },
    { q: 'Who can attend?', a: 'Any undergrad or grad student, from any major.' },
    {
      q: 'When is it?',
      a: 'March 26–28 at Wichita State University. Join our Discord for the full schedule and venue announcements.',
    },
    { q: 'Who runs it?', a: 'The Society of Asian Scientists and Engineers (SASE) chapter at Wichita State.' },
  ],
};

export const close = {
  title: 'Hear first when sign-ups open',
  body: 'Join the SASE Discord for announcements, or email us with questions.',
};
