import { Temporal } from 'temporal-polyfill';

import type { IExperienceTranslation } from './types';

export const welcomeEarlierExperienceEn: readonly IExperienceTranslation[] = [
  {
    id: 'teklabs',
    start: new Temporal.PlainDate(2009, 12, 1),
    end: new Temporal.PlainDate(2010, 11, 1),
    company: 'Teklabs',
    website: 'https://teklabs.com/',
    location: 'Russia, Saint Petersburg',
    scopeOfActivity: 'IT / System Integration / Internet',
    role: 'Lead developer',
    description: (
      <>
        <p>Agricultural Data Management Web Application Developer</p>

        <h4>Project Description:</h4>
        <p>
          Web Silverlight application automating daily farmer tasks and processing data from farms
          across the country. Included monitoring of animal feeding, health care, production
          control, and output volume tracking.
        </p>

        <h4>Achievements:</h4>
        <ul>
          <li>
            Developed domain-specific modules: animal health monitoring, veterinary visit tracking,
            milk quality control, and production output tracking
          </li>
          <li>
            Built a shared UI control library (dozens of components) adopted across the platform —
            buttons, input fields, forms, collapsible accordion cards and more
          </li>
        </ul>
      </>
    ),
  },
  {
    id: 'sitronics',
    start: new Temporal.PlainDate(2008, 1, 1),
    end: new Temporal.PlainDate(2009, 12, 1),
    company: 'Sitronics Telecom Solutions CZ',
    website: 'https://sitronicsts.com/',
    location: 'Czech Republic, Prague',
    role: 'Lead developer',
    description: (
      <>
        <p>Telecommunications Software Developer for Cellular Operators</p>

        <h4>Project Description:</h4>
        <p>
          Information systems and technologies for cellular operators — payment processing, traffic
          management, tariff plan creation, communication equipment handling, and traffic delivery
          between users. Clients included MTS, Vodafone Czech Republic and other leading operators.
        </p>

        <h4>Achievements:</h4>
        <ul>
          <li>
            Developed innovative services for cellular operators — monitoring, billing and charging
            customer traffic for calls, GPRS, SMS/MMS, and USSD
          </li>
        </ul>
      </>
    ),
  },
  {
    id: 'tumlare',
    start: new Temporal.PlainDate(2006, 11, 1),
    end: new Temporal.PlainDate(2007, 12, 1),
    company: 'Tumlare Corporation',
    website: 'https://kuonitumlare.com/',
    location: 'Russia, Saint Petersburg',
    scopeOfActivity: 'Travel Company',
    role: 'Developer',
    description: (
      <>
        <p>Web CMS Developer for Corporate Site Management</p>

        <h4>Project Description:</h4>
        <p>
          Internal-use Web Content Management System for controlling and managing content of
          corporate websites, plus APIs for other travel companies to integrate.
        </p>

        <h4>Achievements:</h4>
        <ul>
          <li>
            Implemented new features and functionalities that improved the user experience and
            streamlined the content management process in the CMS
          </li>
        </ul>
      </>
    ),
  },
  {
    id: '1c-rarus',
    start: new Temporal.PlainDate(2005, 4, 1),
    end: new Temporal.PlainDate(2006, 11, 1),
    company: '1C-Rarus',
    website: 'https://rarus.ru/',
    location: 'Russia, Moscow',
    scopeOfActivity: 'IT / System Integration / Software Development',
    role: 'Developer',
    description: (
      <>
        <p>Web Interface Developer for 1C:Enterprise Applications</p>

        <h4>Project Description:</h4>
        <p>
          Web interfaces for existing applications within the 1C:Enterprise system — a popular
          Russian platform for automating financial and operational activities. These interfaces
          enabled remote editing and processing of data via internet / intranet.
        </p>

        <h4>Achievements:</h4>
        <ul>
          <li>
            Developed several web interfaces for 1C:Enterprise applications, enhancing user
            experience and facilitating remote access for data management
          </li>
        </ul>
      </>
    ),
  },
  {
    id: 'freelance',
    start: new Temporal.PlainDate(2002, 3, 1),
    end: new Temporal.PlainDate(2005, 4, 1),
    company: 'Freelance',
    location: 'Russia, Veliky Novgorod',
    role: 'Freelancer',
    description: (
      <>
        <h4>Freelance Software Developer and Web Designer</h4>
        <p>
          Provided freelance development and web design services to companies such as Antares
          Software, Promogroup, Hansa Consulting, and individual clients.
        </p>

        <h4>Achievements:</h4>
        <ul>
          <li>
            For Antares Software:
            <ul>
              <li>
                Developed Cetris game for the <strong>C Pen 600C Handheld Scanner</strong>
              </li>
              <li>Windows CE device games</li>
              <li>File system for Windows games</li>
            </ul>
          </li>
          <li>
            For Promogroup:
            <ul>
              <li>
                <strong>Gazinvest Bank</strong> web site
              </li>
              <li>
                <strong>ID Cards</strong> web site
              </li>
            </ul>
          </li>
          <li>
            For Hansa Consulting:
            <ul>
              <li>Implemented a content filtering HTTP proxy to enhance network security</li>
            </ul>
          </li>
          <li>
            For individual clients — designed and developed various websites and standalone
            applications tailored to their needs
          </li>
        </ul>
      </>
    ),
  },
];
