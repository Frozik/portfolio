import { Temporal } from '@js-temporal/polyfill';
import { isEmpty, isNil } from 'lodash-es';
import { ExternalLink } from 'lucide-react';
import type { ReactNode } from 'react';
import { memo } from 'react';
import { cn } from '../../../../shared/lib/cn';

import styles from '../styles.module.scss';
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
          <li>Successfully developed and implemented several critical system modules.</li>
          <li>
            Created and deployed user-centric UI controls which were subsequently incorporated into
            the core set of application UI controls.
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
          <li>Successfully developed and implemented several critical system modules.</li>
          <li>
            Created and deployed user-centric UI controls which were subsequently incorporated into
            the core set of application UI controls.
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
          <li>Successfully developed various components of the CRM application.</li>
          <li>
            Improved internal workflows and task management by implementing the new CRM system.
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
            Successfully created multiple new applications for{' '}
            <a href="https://autobahn.db.com/autobahn/index.html" target="_blank" rel="noreferrer">
              Autobahn platform
            </a>
          </li>
          <li>Revamped and modernized several legacy applications</li>
          <li>
            Developed a shared controls core UI library to streamline applications design and
            functionality
          </li>
          <li>
            Implemented innovative features for existing applications to enhance user experience
          </li>
          <li>
            Collaborated with the testing team in developing an effective testing framework to
            ensure application reliability and performance
          </li>
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
        <ul>
          <li>
            Developing a versatile data visualization web application (Creating high-performance
            WebGL-based charts, scalable from years down to nanoseconds, to monitor the HFT system;
            Designing large-scale tables and grids with customizable visualization logic)
          </li>
          <li>Developing web applications for configuring the internals of the HFT system</li>
          <li>Developing a web application that generates comprehensive trading reports</li>
          <li>Developing Middle Office web application for Risk Management and PnL</li>
        </ul>
      </>
    ),
  },
].reverse();

const SMALLEST_START_DATE = EMPLOYMENT_HISTORY.reduce(
  (acc, { start }) => (Temporal.PlainDate.compare(acc, start) < 0 ? acc : start),
  EMPLOYMENT_HISTORY[0].start
);

export const WorkExperience = memo(() => {
  return (
    <>
      <h2 className={styles.cardTitle}>Work experience — {measureDuration(SMALLEST_START_DATE)}</h2>
      <section className={cn(styles.card, styles.cardWithTitle)}>
        {EMPLOYMENT_HISTORY.map(work => (
          <article className={styles.employer} key={work.company}>
            <div className={styles.companyContainer}>
              <div className={styles.company}>
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
                <h4 className={styles.activityScope}>{work.scopeOfActivity}</h4>
              </div>
              <div className={styles.timeline}>
                <p>
                  {formatDateMonthYear(work.start)} -{' '}
                  {isNil(work.end) ? 'till now' : formatDateMonthYear(work.end)}
                </p>
                <h5>{measureDuration(work.start, work.end)}</h5>
              </div>
            </div>

            <div className={styles.description}>
              <h3>{work.position}</h3>

              {work.description}
            </div>
          </article>
        ))}
      </section>
    </>
  );
});
