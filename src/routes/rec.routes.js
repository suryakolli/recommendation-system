import { Router } from 'express'
import passport from 'passport'
import { getDriver } from '../neo4j.js'
import RecommendationService from '../services/recommendation.service.js'
import {getPagination, getUserId, MOVIE_SORT, PEOPLE_SORT, REC_SORT} from '../utils.js'

const router = new Router()

router.use(passport.authenticate(['jwt', 'anonymous'], { session: false }))

/**
 * @GET /rec/weighted-content
 *
 * This route should return a paginated list of People from the database
 */
router.get('/weighted-content/:id', async (req, res, next) => {
  try {
    const { order, limit, skip } = getPagination(req, REC_SORT)
    const driver = getDriver()

    const recommendationService = new RecommendationService(driver)
    const rec = await recommendationService.weightedContent(req.params.id, order, limit, skip)

    res.json(rec)
  }
  catch(e) {
    next(e)
  }
})


/**
 * @GET /rec/jaccard-index
 *
 * This route should return a paginated list of People from the database
 */
router.get('/jaccard-index/:id', async (req, res, next) => {
  try {
    const { order, limit, skip } = getPagination(req, REC_SORT)
    const driver = getDriver()

    const recommendationService = new RecommendationService(driver)
    const rec = await recommendationService.jaccardIndex(req.params.id, order, limit, skip)

    res.json(rec)
  }
  catch(e) {
    next(e)
  }
})

router.get('/cosine-similarity-content/:id', async (req, res, next) => {
  try {
    const { order, limit, skip } = getPagination(req, REC_SORT)
    const driver = getDriver()
    const userId = getUserId(req)



    const recommendationService = new RecommendationService(driver)
    const rec = await recommendationService.cosineSimilarityUsersContent(req.params.id, order, limit, skip)

    res.json(rec)
  }
  catch(e) {
    next(e)
  }
})



router.get('/pearson-similarity-content/:id', async (req, res, next) => {
  try {
    const { order, limit, skip } = getPagination(req, REC_SORT)
    const driver = getDriver()
    const userId = getUserId(req)



    const recommendationService = new RecommendationService(driver)
    const rec = await recommendationService.pearsonSimilarityUsersContent(req.params.id, order, limit, skip)

    res.json(rec)
  }
  catch(e) {
    next(e)
  }
})


export default router
