import fs from 'fs';
import { GraphQLClient } from 'graphql-request';
import { JSDOM } from 'jsdom';
import semver from 'semver';

const MOD_TABLE_BODY_SELECTOR = '#mods tbody';

const MOD_TOPIC = 'minecraft-forge-mod';
const VERSION_TOPIC_PREFIX = 'minecraft-';
const RELEASES_SUFFIX = '/releases';

const API_ENDPOINT = 'https://api.github.com/graphql';
const AUTH_TOKEN = process.argv[2];

const client = new GraphQLClient(API_ENDPOINT, {
    headers: {
        Authorization: `Bearer ${AUTH_TOKEN}`
    },
});

const getTableEntry = (() => {
    const getTableEntryTemplate = (name, description, releasesUrl, versions) => `<tr>
    <td>${name}</td>
    <td>${description}</td>
    <td>${versions}</td>
    <td><a href="${releasesUrl}" target="_blank">${releasesUrl}</a></td>
</tr>`;
    return (name, description, releasesUrl, versions) => {
        return getTableEntryTemplate(name, description, releasesUrl, versions);
    };
})();

const getQuery = (() => {
    const getQueryTemplate = (reposAfter, repoTopicsAfter) => `{
  viewer {
    repositories(first: 100, privacy: PUBLIC, affiliations: OWNER${reposAfter}) {
      nodes {
        name
        description
        url
        repositoryTopics(first: 1${repoTopicsAfter}) {
          nodes {
            topic {
              name
            }
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
}`;
    return (reposAfter = '', repoTopicsAfter = '') => {
        const args = [reposAfter, repoTopicsAfter];
        args.forEach((arg, index) => {
            if (arg.trim() !== '') {
                args[index] = `, after: "${arg}"`;
            }
        });
        return getQueryTemplate(...args);
    };
})();

const buildModTable = async () => {
    const mods = await getModData();
    const dom = new JSDOM(fs.readFileSync('index.html', 'utf8'));
    const modTableBody = dom.window.document.querySelector(MOD_TABLE_BODY_SELECTOR);
    mods.forEach(mod => {
        const modRow = dom.window.document.createElement('tr');
        modRow.innerHTML = getTableEntry(mod.name, mod.description, mod.releasesUrl, mod.versions.join('\n'));
        modTableBody.appendChild(modRow);
    });
    fs.writeFileSync('dist/index.html', dom.serialize());
};

const getModData = async () => {
    const mods = new Set();
    const reposAndTopics = await getAllReposAndTopics();
    reposAndTopics.forEach(repoAndTopics => {
        let isMod = false;
        let versions = new Set();

        repoAndTopics.topics.forEach(repoTopic => {
            if (repoTopic.startsWith(VERSION_TOPIC_PREFIX) && !isNaN(parseInt(repoTopic.charAt(VERSION_TOPIC_PREFIX.length)))) {
                versions.add(repoTopic.slice(VERSION_TOPIC_PREFIX.length).replace(/-/g, '.'));
            } else if (repoTopic === MOD_TOPIC && !isMod) {
                isMod = true;
            }
        });

        if (!isMod) {
            return;
        }

        versions = Array.from(versions);
        versions.sort((v1, v2) => semver.rcompare(semver.coerce(v1), semver.coerce(v2)));
        mods.add({
            name: repoAndTopics.repository.name,
            description: repoAndTopics.repository.description,
            releasesUrl: repoAndTopics.repository.url + RELEASES_SUFFIX,
            versions: versions,
        });
    });

    return mods;
};

const getAllReposAndTopics = async () => {
    const reposAndTopics = new Set();
    let data = await client.request(getQuery());
    for (const repository of data.viewer.repositories.nodes) {
        const repoTopics = await getAllRepoTopics(repository);
        reposAndTopics.add({
            repository: repository,
            topics: repoTopics,
        });
    }

    while (data.viewer.repositories.pageInfo.hasNextPage) {
        const reposAfter = data.viewer.repositories.pageInfo.endCursor;
        data = await client.request(getQuery(reposAfter));
        for (const repository of data.viewer.repositories.nodes) {
            const repoTopics = await getAllRepoTopics(repository, reposAfter);
            reposAndTopics.add({
                repository: repository,
                topics: repoTopics,
            });
        }
    }

    return reposAndTopics;
};

const getAllRepoTopics = async (repository, reposAfter = '') => {
    const repoTopics = new Set();
    while (true) {
        repository.repositoryTopics.nodes.map(({ topic }) => topic.name).forEach(repoTopic => repoTopics.add(repoTopic));
        if (!repository.repositoryTopics.pageInfo.hasNextPage) {
            break;
        }

        const data = await client.request(getQuery(reposAfter, repository.repositoryTopics.pageInfo.endCursor));
        repository = data.viewer.repositories.nodes.find(({ name }) => name === repository.name);
        if (repository === undefined) {
            break;
        }
    }

    return repoTopics;
};

buildModTable();
