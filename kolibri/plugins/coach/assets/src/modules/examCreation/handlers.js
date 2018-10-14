import pickBy from 'lodash/pickBy';
import uniq from 'lodash/uniq';
import { ContentNodeKinds } from 'kolibri.coreVue.vuex.constants';
import {
  ContentNodeResource,
  ContentNodeSlimResource,
  ContentNodeSearchResource,
  ChannelResource,
} from 'kolibri.resources';
import { assessmentMetaDataState } from 'kolibri.coreVue.vuex.mappers';
import { PageNames } from '../../constants';
import { filterAndAnnotateContentList } from './actions';

function showExamCreationPage(store, params) {
  const { classId, contentList, pageName, ancestors = [], searchResults = null } = params;

  return store.dispatch('loading').then(() => {
    return store.dispatch('setClassState', classId).then(
      () => {
        store.commit('examCreation/SET_ANCESTORS', ancestors);
        store.commit('examCreation/SET_CONTENT_LIST', contentList);
        if (searchResults) {
          store.commit('examCreation/SET_SEARCH_RESULTS', searchResults);
        }
        store.commit('SET_PAGE_NAME', pageName);
        store.commit('SET_TOOLBAR_ROUTE', {
          name: PageNames.EXAMS,
        });
        store.dispatch('notLoading');
      },
      error => {
        store.dispatch('notLoading');
        return store.dispatch('handleApiError', error);
      }
    );
  });
}

export function showExamCreationRootPage(store, params) {
  return store.dispatch('loading').then(() => {
    return ChannelResource.fetchCollection({
      getParams: { available: true, has_exercise: true },
    }).then(channels => {
      const channelContentList = channels.map(channel => ({
        ...channel,
        title: channel.name,
        kind: ContentNodeKinds.CHANNEL,
      }));
      return showExamCreationPage(store, {
        classId: params.classId,
        contentList: channelContentList,
        pageName: PageNames.EXAM_CREATION_ROOT,
      });
    });
  });
}

export function showExamCreationTopicPage(store, params) {
  return store.dispatch('loading').then(() => {
    const { topicId } = params;
    const topicNodePromise = ContentNodeResource.fetchModel({ id: topicId });
    const childNodesPromise = ContentNodeResource.fetchCollection({
      getParams: {
        parent: topicId,
        kind_in: [ContentNodeKinds.TOPIC, ContentNodeKinds.EXERCISE],
      },
    });
    const ancestorsPromise = ContentNodeSlimResource.fetchAncestors(topicId);
    const loadRequirements = [topicNodePromise, childNodesPromise, ancestorsPromise];

    return Promise.all(loadRequirements).then(([topicNode, childNodes, ancestors]) => {
      return filterAndAnnotateContentList(childNodes).then(contentList => {
        return showExamCreationPage(store, {
          classId: params.classId,
          contentList,
          pageName: PageNames.EXAM_CREATION_TOPIC,
          ancestors: [...ancestors, topicNode],
        });
      });
    });
  });
}

export function showExamCreationPreviewPage(store, params) {
  const { classId, contentId } = params;
  return store.dispatch('loading').then(() => {
    return Promise.all([_prepExamContentPreview(store, classId, contentId)])
      .then(([contentNode]) => {
        store.commit('SET_TOOLBAR_ROUTE', {
          name: PageNames.EXAM_CREATION_TOPIC,
          params: {
            topicId: contentNode.parent,
          },
        });
        store.dispatch('notLoading');
      })
      .catch(error => {
        store.dispatch('notLoading');
        return store.dispatch('handleApiError', error);
      });
  });
}

function _prepExamContentPreview(store, classId, contentId) {
  return ContentNodeResource.fetchModel({ id: contentId }).then(
    contentNode => {
      const contentMetadata = assessmentMetaDataState(contentNode);
      store.commit('SET_TOOLBAR_ROUTE', {});
      store.commit('examCreation/SET_CURRENT_CONTENT_NODE', { ...contentNode });
      store.commit('examCreation/SET_PREVIEW_STATE', {
        questions: contentMetadata.assessmentIds,
        completionData: contentMetadata.masteryModel,
      });
      store.commit('SET_PAGE_NAME', PageNames.EXAM_CREATION_PREVIEW);
      return contentNode;
    },
    error => {
      return store.dispatch('handleApiError', error);
    }
  );
}

export function showExamCreationSearchPage(store, params, query = {}) {
  return store.dispatch('loading').then(() => {
    let kinds;
    if (query.kind) {
      kinds = [query.kind];
    } else {
      kinds = [ContentNodeKinds.EXERCISE, ContentNodeKinds.TOPIC];
    }

    return ContentNodeSearchResource.fetchCollection({
      getParams: {
        search: params.searchTerm,
        kind_in: kinds,
        ...pickBy({ channel_id: query.channel }),
        include_fields: ['num_coach_contents'],
      },
    }).then(results => {
      return filterAndAnnotateContentList(results.results).then(contentList => {
        const searchResults = {
          ...results,
          results: contentList,
          content_kinds: results.content_kinds.filter(kind =>
            [ContentNodeKinds.TOPIC, ContentNodeKinds.EXERCISE].includes(kind)
          ),
          contentIdsFetched: uniq(results.results.map(({ content_id }) => content_id)),
        };
        return showExamCreationPage(store, {
          classId: params.classId,
          contentList: contentList,
          pageName: PageNames.EXAM_CREATION_SEARCH,
          searchResults,
        });
      });
    });
  });
}