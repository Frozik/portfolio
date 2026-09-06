import { Temporal } from 'temporal-polyfill';

import type { IExperienceTranslation } from './types';

export const welcomeRecentExperienceEn: readonly IExperienceTranslation[] = [
  {
    id: 'hft',
    start: new Temporal.PlainDate(2022, 2, 1),
    company: 'IP Sharov Dmitry Nikolaevich',
    location: 'Russia, Saint Petersburg',
    role: 'Senior Frontend Engineer · High-Frequency Trading',
    description: (
      <>
        <h4>For High-Frequency Trading company:</h4>
        <p>
          Building a suite of 15+ web applications for a high-frequency trading platform — from
          real-time data visualization to system configuration and risk management.
        </p>

        <h4>Data Visualization:</h4>
        <ul>
          <li>
            High-performance WebGL charting engine rendering tens of millions of data points at
            60fps with GPU-accelerated pan/zoom, scalable from years down to nanoseconds
          </li>
          <li>
            Interactive dashboards with large-scale tables (millions of rows) and real-time data
            streaming via WebSocket
          </li>
          <li>
            Backtesting environment for analyzing trading robot performance on historical data
          </li>
        </ul>

        <h4>Trading Operations UI:</h4>
        <ul>
          <li>
            Trading server management — configuration of accounts, instruments, robots, and risk
            limits across multiple exchanges
          </li>
          <li>
            Balance and position monitoring across all exchanges with risk configuration and
            rebalancing rules
          </li>
          <li>
            Middle Office application for Risk Management, PnL tracking, and trade corrections
          </li>
          <li>Trading statistics analysis and comprehensive report generation</li>
        </ul>

        <h4>Frontend Platform Infrastructure:</h4>
        <ul>
          <li>
            Static Frontend, a BFF (Backend For Frontend) layer, and a variety of Node.js services
            communicating over a custom WebSocket protocol and gRPC (HTTP/2)
          </li>
        </ul>
      </>
    ),
  },
  {
    id: 'db',
    start: new Temporal.PlainDate(2019, 1, 1),
    end: new Temporal.PlainDate(2022, 2, 1),
    company: 'Deutsche Bank',
    website: 'https://www.db.com/',
    location: 'Russia, Saint Petersburg',
    scopeOfActivity: 'Financial Sector / Banking',
    role: 'Assistant Vice President (Senior Frontend Engineer)',
    description: (
      <>
        <p>Development of DB Autobahn Web Application</p>

        <h4>Responsibilities:</h4>
        <ul>
          <li>
            Develop and maintain a business-critical web application, focusing on high-profit
            trading
          </li>
          <li>Ensure seamless operation and top-quality functionality for users</li>
        </ul>

        <h4>Achievements:</h4>
        <ul>
          <li>
            Built 5+ order entry apps for different trade types on the{' '}
            <a href="https://autobahn.db.com/autobahn/index.html" target="_blank" rel="noreferrer">
              Autobahn platform
            </a>
            ; maintained flagship trading and active order monitoring products
          </li>
          <li>Revamped and modernized several legacy applications</li>
          <li>
            Developed a shared UI controls library used across all Autobahn applications — trading
            calendar with business day rules, sliding tenor support (TOM, TOD, SPOT), natural
            language date input (e.g. &quot;tom 10am&quot;), financial data input fields, layout
            components, and a wide range of other controls. The library was built following BEM
            principles, ensuring maintainable, scalable, and reusable code.
          </li>
          <li>
            Designed and proposed a page-description-based testing framework with server response
            replay, enabling 100% business functionality coverage.
          </li>
          <li>
            Implemented interaction patterns and performance optimizations, achieving sub-second
            application startup times — ensuring instant loading regardless of network conditions,
            even on the weakest VDI setups.
          </li>
          <li>Investigated and resolved production incidents</li>
        </ul>
      </>
    ),
  },
  {
    id: 'grid-rj',
    start: new Temporal.PlainDate(2017, 4, 1),
    end: new Temporal.PlainDate(2018, 12, 1),
    company: 'Grid Dynamics (Raymond-James)',
    website: 'https://griddynamics.com/',
    location: 'Russia, Saint Petersburg',
    role: 'Lead Frontend Developer',
    description: (
      <>
        <p>Development of Internal-Use CRM Software for Raymond-James customer</p>

        <h4>Responsibilities:</h4>
        <ul>
          <li>Develop and maintain a web-based CRM system to streamline internal processes</li>
          <li>
            Collaborate with cross-functional teams to ensure seamless integration and efficient
            functionality of the application
          </li>
        </ul>

        <h4>Achievements:</h4>
        <ul>
          <li>
            Built core CRM modules: visual workflow editor for customizable task pipelines, email
            template management system, contact and deal management views, activity timeline, and
            role-based access controls
          </li>
          <li>
            Integrated the CRM with customer&apos;s existing infrastructure — email delivery
            services, internal directories, and notification systems — delivering a seamless
            migration from legacy tools
          </li>
        </ul>
      </>
    ),
  },
  {
    id: 'grid',
    start: new Temporal.PlainDate(2016, 11, 1),
    end: new Temporal.PlainDate(2017, 4, 1),
    company: 'Grid Dynamics',
    website: 'https://griddynamics.com/',
    location: 'Russia, Saint Petersburg',
    role: 'Lead Frontend Developer',
    description: (
      <>
        <p>Angular 2 E-commerce Pre-sale Web Application Developer</p>

        <h4>Project Description:</h4>
        <p>
          Proof-of-concept Angular 2 e-commerce platform for a GridDynamics client. Three
          components: a customer-facing online store, an analytics platform for inventory and sales
          performance, and an administration panel.
        </p>

        <h4>Achievements:</h4>
        <ul>
          <li>Developed the e-commerce application from the ground up</li>
          <li>
            Delivered a proof-of-concept demonstrating the viability of a comprehensive Angular
            2-based platform
          </li>
        </ul>
      </>
    ),
  },
  {
    id: 'yamoney',
    start: new Temporal.PlainDate(2012, 8, 1),
    end: new Temporal.PlainDate(2016, 11, 1),
    company: 'Yandex Money',
    website: 'https://yoomoney.ru/',
    location: 'Russia, Saint Petersburg',
    scopeOfActivity: 'IT / Internet / Banking — digital payment platform',
    role: 'Lead developer => Team leader',
    description: (
      <>
        <p>Contact Center Portal Development Lead</p>

        <h4>Project Description:</h4>
        <p>
          Comprehensive Contact Center Portal — the central hub for managing all customer
          interactions (calls, emails, main-site requests). Featured unique dashboards for managers
          and operators: manager dashboard for monitoring operators, service quality, growth
          planning and strategic routing; operator dashboard for efficient call/email processing
          with customer history, template responses and internal forwarding.
        </p>

        <h4>Responsibilities:</h4>
        <ul>
          <li>Team leadership and management</li>
          <li>Full-stack software development</li>
          <li>Software architecture and design</li>
        </ul>

        <h4>Achievements:</h4>
        <ul>
          <li>
            Developed a ground-breaking Contact Center Portal from scratch that integrated customer
            requests in a single place
          </li>
          <li>
            The Contact Center was recognized as the &quot;Achievement of the Year 2016&quot;,
            significantly improving response times and overall service quality
          </li>
        </ul>
      </>
    ),
  },
  {
    id: 'yandex',
    start: new Temporal.PlainDate(2010, 11, 1),
    end: new Temporal.PlainDate(2012, 8, 1),
    company: 'Yandex',
    website: 'https://ya.ru/',
    location: 'Russia, Saint Petersburg',
    scopeOfActivity: 'IT / Internet',
    role: 'Developer',
    description: (
      <>
        <p>Geospatial Data Analyst and Developer at Yandex.Maps</p>

        <h4>Project Description:</h4>
        <p>
          Analysis, processing, and rendering of geospatial data for Yandex.Maps. Developed
          applications assisting cartographers in adding and editing map features (houses, roads)
          from satellite imagery, aerial photographs, and panoramic pictures, plus error detection
          in supplier or self-generated data.
        </p>

        <h4>Achievements:</h4>
        <ul>
          <li>
            Developed cartographic tools for geospatial data analysis, processing, and rendering on{' '}
            <a href="https://yandex.ru/maps" target="_blank" rel="noreferrer">
              Yandex.Maps
            </a>{' '}
            using satellite imagery and panoramic pictures
          </li>
        </ul>
      </>
    ),
  },
];
