import { Temporal } from '@js-temporal/polyfill';
import { isEmpty, isNil } from 'lodash-es';
import { ExternalLink } from 'lucide-react';
import type { ReactNode } from 'react';
import { memo } from 'react';

import { formatDateMonthYear, measureDuration } from '../utils';

interface IWork {
  start: Temporal.PlainDate;
  end?: Temporal.PlainDate;
  company: string;
  website?: string;
  location?: string;
  scopeOfActivity?: ReactNode;
  position: string;
  description: ReactNode;
}

const EMPLOYMENT_HISTORY: IWork[] = [
  {
    start: new Temporal.PlainDate(2002, 3, 1),
    end: new Temporal.PlainDate(2005, 4, 1),
    company: 'Freelance',
    location: 'Russia, Veliky Novgorod',
    position: 'Freelancer',
    description: (
      <>
        <h4>Freelance Software Developer and Web Designer</h4>
        <p>
          I have provided freelance software development and web design services to various
          companies, such as Antares Software, Promogroup, Hansa Consulting, and individual clients.
        </p>

        <h4>Responsibilities:</h4>
        <ul>
          <li>
            Establish and maintain contact with clients to ensure their project requirements are met
          </li>
          <li>Develop applications and websites according to specifications</li>
        </ul>

        <h4>Achievements:</h4>
        <ul>
          <li>
            For Antares Software company:
            <ul>
              <li>
                Developed Cetris game for the&nbsp;
                <strong>C Pen 600C Handheld Scanner</strong>
              </li>
              <li>Windows CE devices games</li>
              <li>File system for Windows games</li>
            </ul>
          </li>
          <li>
            For Promogroup company:
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
            For Hansa Consulting company:
            <ul>
              <li>Implemented a content filtering HTTP proxy to enhance network security</li>
            </ul>
          </li>
          <li>
            For individual clients
            <ul>
              <li>
                Designed and developed various websites and standalone applications tailored to
                their needs
              </li>
            </ul>
          </li>
        </ul>
      </>
    ),
  },
  {
    start: new Temporal.PlainDate(2005, 4, 1),
    end: new Temporal.PlainDate(2006, 11, 1),
    company: '1C-\u0420\u0430\u0440\u0443\u0441',
    website: 'https://rarus.ru/',
    location: 'Russia, Moscow',
    scopeOfActivity: (
      <>
        IT, System Integration, Internet
        <ul>
          <li>Software Development</li>
          <li>
            System Integration, Technological and Business Processes Automation, IT Consulting
          </li>
        </ul>
      </>
    ),
    position: 'Developer',
    description: (
      <>
        <p>Web Interface Developer for 1C:Enterprise Applications</p>

        <h4>Project Description:</h4>
        <p>
          My role involved creating web interfaces for existing applications within the
          1C:Enterprise system, a popular platform in Russia for automating a company&apos;s
          financial and operational activities. These web interfaces enabled users to edit and
          process data remotely via internet or intranet connections.
        </p>

        <h4>Responsibilities:</h4>
        <ul>
          <li>
            Develop user-friendly and responsive web interfaces for applications within the
            1C:Enterprise system
          </li>
        </ul>

        <h4>Achievements:</h4>
        <ul>
          <li>
            Successfully developed several web interfaces for 1C:Enterprise applications, enhancing
            the user experience and facilitating remote access for data management
          </li>
        </ul>
      </>
    ),
  },
  {
    start: new Temporal.PlainDate(2006, 11, 1),
    end: new Temporal.PlainDate(2007, 12, 1),
    company: 'Tumlare Corporation',
    website: 'https://kuonitumlare.com/',
    location: 'Russia, Saint Petersburg',
    scopeOfActivity: (
      <>
        Public Services
        <ul>
          <li>Travel Companies</li>
        </ul>
      </>
    ),
    position: 'Developer',
    description: (
      <>
        <p>Web CMS Developer for Corporate Site Management</p>

        <h4>Project Description:</h4>
        <p>
          I was involved in the development of an internal-use Web Content Management System (CMS)
          designed to control and manage the content of corporate websites and provide APIs for
          other travel companies to integrate with our platform.
        </p>

        <h4>Responsibilities:</h4>
        <ul>
          <li>
            Develop, maintain and enhance the web-based CMS for the company&apos;s corporate site
            management.
          </li>
        </ul>

        <h4>Achievements:</h4>
        <ul>
          <li>
            Successfully implemented new features and functionalities to improve the user experience
            and streamline the content management process in the CMS.
          </li>
        </ul>
      </>
    ),
  },
  {
    start: new Temporal.PlainDate(2008, 1, 1),
    end: new Temporal.PlainDate(2009, 12, 1),
    company: 'Sitronics Telecom Solutions CZ',
    website: 'https://sitronicsts.com/',
    location: 'Czech Republic, Prague',
    position: 'Lead developer',
    description: (
      <>
        <p>Telecommunications Software Developer for Cellular Operators</p>

        <h4>Project Description:</h4>
        <p>
          I worked on the development of information systems and technologies catering to the needs
          of cellular operators. The solutions provided included processing payments, traffic
          management, tariff plan creation, communication equipment handling, and traffic delivery
          from one user to another, among other services. Some of the largest cellular operators
          using these systems or parts of them include MTS (a leading Russian cellular operator),
          Vodafone Czech Republic, and more.
        </p>

        <h4>Responsibilities:</h4>
        <ul>
          <li>
            Develop online billing and self-care scenarios for various services such as calls, GPRS,
            SMS/MMS, and USSD.
          </li>
          <li>Provide emergency support and resolve any critical issues as needed.</li>
        </ul>

        <h4>Achievements:</h4>
        <ul>
          <li>
            Developed innovative services for cellular operators aimed at monitoring, billing, and
            charging customer traffic for calls, GPRS, SMS/MMS, and USSD.
          </li>
        </ul>
      </>
    ),
  },
  {
    start: new Temporal.PlainDate(2009, 12, 1),
    end: new Temporal.PlainDate(2010, 11, 1),
    company: 'Teklabs',
    website: 'https://teklabs.com/',
    location: 'Russia, Saint Petersburg',
    scopeOfActivity: (
      <>
        IT, System Integration, Internet
        <ul>
          <li>
            System Integration, Technological and Business Processes Automation, IT Consulting
          </li>
        </ul>
      </>
    ),
    position: 'Lead developer',
    description: (
      <>
        <p>Agricultural Data Management Web Application Developer</p>

        <h4>Project Description:</h4>
        <p>
          I contributed to the development of a web silverlight application designed to streamline
          and automate the daily tasks of farmers and to process data from farms located across the
          country. The application included features for monitoring animal feeding, health care,
          production control, output volume tracking, and more.
        </p>

        <h4>Responsibilities:</h4>
        <ul>
          <li>Develop and maintain multiple modules within the web application.</li>
          <li>Collaborate with cross-functional teams to ensure a seamless user experience.</li>
        </ul>

        <h4>Achievements:</h4>
        <ul>
          <li>
            Developed domain-specific modules: animal health monitoring, veterinary visit tracking,
            milk quality control, and production output tracking.
          </li>
          <li>
            Built a shared UI control library (dozens of components) adopted across the platform —
            buttons, input fields, forms, collapsible accordion cards, and more.
          </li>
        </ul>
      </>
    ),
  },
  {
    start: new Temporal.PlainDate(2010, 11, 1),
    end: new Temporal.PlainDate(2012, 8, 1),
    company: 'Yandex',
    website: 'https://ya.ru/',
    location: 'Russia, Saint Petersburg',
    scopeOfActivity: (
      <>
        IT, System Integration, Internet
        <ul>
          <li>
            Internet Company (Search Engines, Payment Systems, Social Networks, Information and
            Educational, Entertainment Resources, Website Promotion etc.)
          </li>
        </ul>
      </>
    ),
    position: 'Developer',
    description: (
      <>
        <p>Geospatial Data Analyst and Developer at Yandex.Maps</p>

        <h4>Project Description:</h4>
        <p>
          My work involved the analysis, processing, and rendering of geospatial data for
          Yandex.Maps. I developed applications that assisted cartographers in adding and editing
          map features (such as houses, roads, and more) using satellite imagery, aerial
          photographs, and panoramic pictures, as well as checking for errors in supplier or
          self-generated data.
        </p>

        <h4>Responsibilities:</h4>
        <ul>
          <li>Develop tools to analyze and process geospatial data.</li>
          <li>
            Create applications for rendering geospatial data on{' '}
            <a href="https://yandex.ru/maps" target="_blank" rel="noreferrer">
              Yandex.Maps
            </a>
          </li>
        </ul>

        <h4>Achievements:</h4>
        <ul>
          <li>
            Developed cartographic tools for geospatial data analysis, processing, and rendering on
            Yandex.Maps using satellite imagery and panoramic pictures.
          </li>
        </ul>
      </>
    ),
  },
  {
    start: new Temporal.PlainDate(2012, 8, 1),
    end: new Temporal.PlainDate(2016, 11, 1),
    company: 'Yandex Money',
    website: 'https://yoomoney.ru/',
    location: 'Russia, Saint Petersburg',
    scopeOfActivity: (
      <>
        IT, System Integration, Internet
        <ul>
          <li>
            Internet Company (Search Engines, Payment Systems, Social Networks, Information and
            Educational, Entertainment Resources, Website Promotion etc.)
          </li>
          <li>Software Development</li>
        </ul>
      </>
    ),
    position: 'Lead developer => Team leader',
    description: (
      <>
        <p>Contact Center Portal Development Lead</p>

        <h4>Project Description:</h4>
        <p>
          The project involved the development of a comprehensive Contact Center Portal, which
          served as the central hub in an enterprise for managing all customer interactions (calls,
          emails and requests from the main site). The goal was to minimize response times and
          enhance service quality. The portal featured unique dashboards for both managers and
          operators. The Manager Dashboard enabled the monitoring and control of operators
          performance, service quality, growth planning, and strategic routing of inquiries. The
          Operator Dashboard facilitated efficient processing of calls and emails, offering features
          such as customer request and activities history, template responses for common queries,
          and internal correspondence forwarding mechanisms.
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
            Successfully developed a ground-breaking Contact Center Portal from scratch that
            integrated customer requests in single place.
          </li>
          <li>
            The Contact Center was recognized as the &quot;Achievement of the Year 2016&quot;,
            significantly improving response times and raising the overall quality of service.
          </li>
        </ul>
      </>
    ),
  },
  {
    start: new Temporal.PlainDate(2016, 11, 1),
    end: new Temporal.PlainDate(2017, 4, 1),
    company: 'Grid Dynamics',
    website: 'https://griddynamics.com/',
    location: 'Russia, Saint Petersburg',
    position: 'Lead Frontend Developer',
    description: (
      <>
        <p>Angular 2 E-commerce Pre-sale Web Application Developer</p>

        <h4>Project Description:</h4>
        <p>
          The objective of the project was to develop a proof-of-concept Angular 2 e-commerce
          platform for one of GridDynamics clients. The solution consisted of three main components:
          a customer-facing online store, an analytics platform for monitoring inventory and sales
          performance, and an administration panel for managing the overall system.
        </p>

        <h4>Responsibilities:</h4>
        <ul>
          <li>Implement core application functionality</li>
          <li>Develop custom UI controls</li>
          <li>Analyze requirements and business needs</li>
          <li>Design software architecture</li>
        </ul>

        <h4>Achievements:</h4>
        <ul>
          <li>Successfully developed the e-commerce application from the ground up</li>
          <li>
            Delivered a proof-of-concept solution that demonstrated the viability and potential
            benefits of a comprehensive Angular 2-based e-commerce platform
          </li>
        </ul>
      </>
    ),
  },
  {
    start: new Temporal.PlainDate(2017, 4, 1),
    end: new Temporal.PlainDate(2018, 12, 1),
    company: 'Grid Dynamics (Raymond-James)',
    website: 'https://griddynamics.com/',
    location: 'Russia, Saint Petersburg',
    position: 'Lead Frontend Developer',
    description: (
      <>
        <p>Development of Internal-Use CRM Software for Raymond-James customer</p>

        <h4>Responsibilities:</h4>
        <ul>
          <li>Develop and maintain a web-based CRM system to streamline internal processes.</li>
          <li>
            Collaborate with cross-functional teams to ensure seamless integration and efficient
            functionality of the application.
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
    start: new Temporal.PlainDate(2019, 1, 1),
    end: new Temporal.PlainDate(2022, 2, 1),
    company: 'Deutsche Bank',
    website: 'https://www.db.com/',
    location: 'Russia, Saint Petersburg',
    scopeOfActivity: (
      <>
        Financial Sector
        <ul>
          <li>Banking</li>
        </ul>
      </>
    ),
    position: 'Assistant Vice President (Senior Frontend Engineer)',
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
            Built 5+ order entry forms for different trade types on the{' '}
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
            principles, ensuring maintainable, scalable, and reusable code. Controls were designed
            to be composable, allowing complex UI components to be assembled through combinations of
            simpler base controls, enabling rapid and consistent development across the entire
            application suite.
          </li>
          <li>
            Designed and proposed a page-description-based testing framework concept with server
            response replay, along with a basic Proof-of-Concept implementation, enabling 100%
            business functionality coverage.
          </li>
          <li>
            Implemented interaction patterns and performance optimizations, achieving sub-second
            application startup times across all applications — ensuring instant loading and smooth
            operation regardless of the trader's network channel, even on the weakest VDI setups.
          </li>
          <li>Investigated and resolved production incidents</li>
        </ul>
      </>
    ),
  },
  {
    start: new Temporal.PlainDate(2022, 2, 1),
    company: 'IP Sharov Dmitry Nikolaevich',
    position: 'Sole Proprietor',
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
            Interactive dashboards with large-scale tables (millions of rows), customizable layouts,
            and real-time data streaming via WebSocket
          </li>
          <li>
            Backtesting environment for analyzing trading robot performance on historical data
          </li>
        </ul>

        <h4>Trading Operations:</h4>
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

        <h4>Platform Infrastructure:</h4>
        <ul>
          <li>Shared component library, BFF (Backend For Frontend) layer</li>
        </ul>
      </>
    ),
  },
].reverse();

export const SMALLEST_START_DATE = EMPLOYMENT_HISTORY.reduce(
  (acc, { start }) => (Temporal.PlainDate.compare(acc, start) < 0 ? acc : start),
  EMPLOYMENT_HISTORY[0].start
);

export const WorkExperience = memo(() => {
  return (
    <>
      <h2 className="mx-5 mb-1 shrink-0 text-white print:text-black">
        Work experience — {measureDuration(SMALLEST_START_DATE)}
      </h2>
      <section className="mx-5 mb-5 flex shrink-0 flex-col gap-3 border-t border-[#434343] pt-0.5 [&_h1]:m-0 [&_h1]:text-white [&_h2]:m-0 [&_h2]:text-white [&_h3]:m-0 [&_h3]:text-white [&_h4]:m-0 [&_h4]:text-white [&_h5]:m-0 [&_h5]:text-white [&_h6]:m-0 [&_h6]:text-white [&_ul]:pl-0 [&_li]:list-none print:border-t-[#ccc] print:[&_h1]:text-black print:[&_h2]:text-black print:[&_h3]:text-black print:[&_h4]:text-black print:[&_h5]:text-black print:[&_h6]:text-black">
        {EMPLOYMENT_HISTORY.map(work => (
          <article className="flex flex-1 flex-col" key={work.company}>
            <div className="flex shrink-0 flex-row gap-3 bg-black px-2.5 py-1 print:bg-[#f5f5f5]">
              <div className="flex-1 [&_a]:text-white [&_a]:no-underline print:[&_a]:text-black">
                <h2>
                  {isEmpty(work.website) ? (
                    work.company
                  ) : (
                    <a href={work.website} target="_blank" rel="noreferrer">
                      {work.company} <ExternalLink size={14} className="inline" />
                    </a>
                  )}
                </h2>
                <h5>{work.location}</h5>
                <h4 className="text-[#8c8c8c] [&_ul]:m-0 [&_ul]:pl-5 [&_li]:list-disc">
                  {work.scopeOfActivity}
                </h4>
              </div>
              <div className="shrink-0 [&_p]:m-0">
                <p>
                  {formatDateMonthYear(work.start)} -{' '}
                  {isNil(work.end) ? 'till now' : formatDateMonthYear(work.end)}
                </p>
                <h5>{measureDuration(work.start, work.end)}</h5>
              </div>
            </div>

            <div className="border-l-4 border-l-[#003eb3] px-2.5 py-2 [&_a]:text-[#1677ff] [&_ul]:mb-3 [&_ul]:pl-5 [&_li]:list-disc [&_ul_ul]:pl-5 [&_ul_ul_li]:list-[circle] print:border-l-[#999] print:[&_a]:text-[#333]">
              <h3>{work.position}</h3>

              {work.description}
            </div>
          </article>
        ))}
      </section>
    </>
  );
});
