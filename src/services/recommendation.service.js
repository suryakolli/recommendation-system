import { int } from 'neo4j-driver'
import { toNativeTypes } from '../utils.js'
import MovieService from './movie.service.js'

export default class RecommendationService {
  /**
     * @type {neo4j.Driver}
     */
  driver
  movieService

  /**
     * The constructor expects an instance of the Neo4j Driver, which will be
     * used to interact with Neo4j.
     *
     * @param {neo4j.Driver} driver
     */
  constructor(driver) {
    this.driver = driver
    this.movieService = new MovieService(driver)
  }

  getSimilarMovies(id, limit = 6, skip = 0, userId = undefined) {
    return this.pearsonSimilarityUsersContent(id, limit, skip, userId)
  }


  // get recommendations based on weighted content algorithm
  async weightedContent(id, limit = 6, skip = 0, userId = undefined) {
    // Open a new database session
    const session = this.driver.session()

    // Get recommendations based on weighted content
    const res = await session.readTransaction(async tx => {
      const favorites = await this.movieService.getUserFavorites(tx, userId)

      return tx.run(`
        MATCH (m:Movie) WHERE m.tmdbId = $id
        MATCH (m)-[:IN_GENRE]->(g:Genre)<-[:IN_GENRE]-(rec:Movie)
        WITH m, rec, count(*) AS gs
        OPTIONAL MATCH (m)<-[:ACTED_IN]-(a)-[:ACTED_IN]->(rec)
        WITH m, rec, gs, count(a) AS as
        OPTIONAL MATCH (m)<-[:DIRECTED]-(d)-[:DIRECTED]->(rec)
        WITH m, rec, gs, as, count(d) AS ds
        RETURN rec {
          .*,
          score: (5*gs)+(3*as)+(4*ds),
          favorite: m.tmdbId IN $favorites
        } AS data
        ORDER BY data.score DESC
        SKIP $skip LIMIT $limit
      `, { id, skip: int(skip), limit: int(limit), favorites })
    })

    // Close the session
    await session.close()
    return res.records.map(row => toNativeTypes(row.get('data')))
  }

  async jaccardIndex(id, limit = 6, skip = 0, userId = undefined) {
    // Open a new database session
    const session = this.driver.session()

    const res = await session.readTransaction(async tx => {
      const favorites = await this.movieService.getUserFavorites(tx, userId)

      return tx.run(`
        MATCH (m:Movie {tmdbId: $id})-[:IN_GENRE|ACTED_IN|DIRECTED]-
                   (t)<-[:IN_GENRE|ACTED_IN|DIRECTED]-(other:Movie)
                    WITH m, other, count(t) AS intersection, collect(t.name) AS common,
                         [(m)-[:IN_GENRE|ACTED_IN|DIRECTED]-(mt) | mt.name] AS set1,
                         [(other)-[:IN_GENRE|ACTED_IN|DIRECTED]-(ot) | ot.name] AS set2
                    
                    WITH m,other,intersection, common, set1, set2,
                         set1 + [x IN set2 WHERE NOT x IN set1] AS union
                    
                    RETURN 
        other { 
          .*,
          score: ((1.0*intersection)/size(union)),
          favorite: m.tmdbId IN $favorites
        } as data
        ORDER BY data.score DESC
        SKIP $skip LIMIT $limit
      `, { id, skip: int(skip), limit: int(limit), favorites })
    })

    // Close the session
    await session.close()
    return res.records.map(row => toNativeTypes(row.get('data')))
  }

  async cosineSimilarityUsersContent(id, limit = 6, skip = 0, userId = undefined) {
    if(!userId) return []

    // Open a new database session
    const session = this.driver.session()

    // Get recommendations based on cosine similarity users content
    const res = await session.readTransaction(async tx => {
      const favorites = await this.movieService.getUserFavorites(tx, userId)

      return tx.run(`
        MATCH (p1:User {userId: $userId})-[x:RATED]->
              (m:Movie)<-[y:RATED]-(p2:User)
        WITH p1, p2, count(m) AS numbermovies,
             sum(x.rating * y.rating) AS xyDotProduct,
             collect(x.rating) as xRatings, collect(y.rating) as yRatings
        WHERE numbermovies > 10
        WITH p1, p2, xyDotProduct,
        sqrt(reduce(xDot = 0.0, a IN xRatings | xDot + a^2)) AS xLength,
        sqrt(reduce(yDot = 0.0, b IN yRatings | yDot + b^2)) AS yLength
        CALL {
            WITH p1, p2
            MATCH (p2:User)-[p2r:RATED]->(m2:Movie)
            WHERE NOT EXISTS {(p1:User)-[:RATED]-(m2)}
            RETURN m2
            ORDER BY p2r.rating DESC
            LIMIT 1
        }
        RETURN m2 {
          .*,
          score: xyDotProduct / (xLength * yLength),
          favorite: m2.tmdbId IN $favorites
        } AS data
        ORDER BY data.score DESC
        SKIP $skip LIMIT $limit
      `, { userId, skip: int(skip), limit: int(limit), favorites })
    })

    // Close the session
    await session.close()
    return res.records.map(row => toNativeTypes(row.get('data')))
  }

  async pearsonSimilarityUsersContent(id, limit = 6, skip = 0, userId = undefined) {
    if(!userId) return []

    // Open a new database session
    const session = this.driver.session()

    // Get recommendations based on cosine similarity users content
    const res = await session.readTransaction(async tx => {
      const favorites = await this.movieService.getUserFavorites(tx, userId)

      return tx.run(`
        MATCH (u1:User {userId: $userId})-[r:RATED]->(m:Movie)
        WITH u1, avg(r.rating) AS u1_mean
        
        MATCH (u1)-[r1:RATED]->(m:Movie)<-[r2:RATED]-(u2)
        WITH u1, u1_mean, u2, collect({r1: r1, r2: r2}) AS ratings
        WHERE size(ratings) > 10
        
        MATCH (u2)-[r:RATED]->(m:Movie)
        WITH u1, u1_mean, u2, avg(r.rating) AS u2_mean, ratings
        
        UNWIND ratings AS r
        
        WITH sum( (r.r1.rating-u1_mean) * (r.r2.rating-u2_mean) ) AS nom,
             sqrt( sum( (r.r1.rating - u1_mean)^2) * sum( (r.r2.rating - u2_mean) ^2)) AS denom,
             u1, u2 WHERE denom <> 0
        CALL {
            WITH u1, u2
            MATCH (u2:User)-[u2r:RATED]->(m2:Movie)
            WHERE NOT EXISTS {(u1:User)-[:RATED]-(m2)}
            RETURN m2
            ORDER BY u2r.rating DESC
            LIMIT 1
        }
        RETURN m2 { 
          .*,
          score: nom/denom,
          favorite: m2.tmdbId IN $favorites
          } AS data
        ORDER BY data.score DESC
        SKIP $skip LIMIT $limit
      `, { userId, skip: int(skip), limit: int(limit), favorites })
    })

    // Close the session
    await session.close()
    return res.records.map(row => toNativeTypes(row.get('data')))
  }

  // async weightedContent(id, order = 'DESC', limit = 6, skip = 0) {
  //   // Open a new database session
  //   const session = this.driver.session()
  //
  //   // Get recommendations based on weighted content
  //   const res = await session.readTransaction(
  //       tx => tx.run(`
  //       MATCH (m:Movie) WHERE m.tmdbId = $id
  //       MATCH (m)-[:IN_GENRE]->(g:Genre)<-[:IN_GENRE]-(rec:Movie)
  //       WITH m, rec, count(*) AS gs
  //       OPTIONAL MATCH (m)<-[:ACTED_IN]-(a)-[:ACTED_IN]->(rec)
  //       WITH m, rec, gs, count(a) AS as
  //       OPTIONAL MATCH (m)<-[:DIRECTED]-(d)-[:DIRECTED]->(rec)
  //       WITH m, rec, gs, as, count(d) AS ds
  //       RETURN {recommendation: rec.title, score: (5*gs)+(3*as)+(4*ds)} AS data
  //       ORDER BY data.score DESC
  //       SKIP $skip LIMIT $limit
  //     `, { id: String(id), limit: int(limit), skip: int(skip) })
  //   )
  //
  //   // Close the session
  //   await session.close()
  //   return res.records.map(row => toNativeTypes(row.get('data')))
  // }
  //
  // async jaccardIndex(id, order = 'DESC', limit = 6, skip = 0) {
  //   // Open a new database session
  //   const session = this.driver.session()
  //
  //   // Get recommendations based on jaccard
  //   const res = await session.readTransaction(
  //       tx => tx.run(`
  //       MATCH (m:Movie {tmdbId: $id})-[:IN_GENRE]->
  //       (g:Genre)<-[:IN_GENRE]-(other:Movie)
  //       WITH m, other, count(g) AS intersection, collect(g.name) as common
  //
  //       WITH m,other, intersection, common,
  //            [(m)-[:IN_GENRE]->(mg) | mg.name] AS set1,
  //            [(other)-[:IN_GENRE]->(og) | og.name] AS set2
  //
  //       WITH m,other,intersection, common, set1, set2,
  //            set1+[x IN set2 WHERE NOT x IN set1] AS union
  //
  //       RETURN { recommendation: other.title, jaccard: ((1.0*intersection)/size(union))} as data
  //       ORDER BY data.jaccard DESC SKIP $skip LIMIT $limit
  //     `, { id: String(id), limit: int(limit), skip: int(skip) })
  //   )
  //
  //   // Close the session
  //   await session.close()
  //   return res.records.map(row => toNativeTypes(row.get('data')))
  // }
  //
  // async cosineSimilarityUsersContent(userId, order = 'DESC', limit = 6, skip = 0) {
  //   // Open a new database session
  //   const session = this.driver.session()
  //
  //   // Get recommendations based on weighted content
  //   const res = await session.readTransaction(
  //       tx => tx.run(`
  //       MATCH (p1:User {userId: $id})-[x:RATED]->
  //             (m:Movie)<-[y:RATED]-(p2:User)
  //       WITH p1, p2, count(m) AS numbermovies,
  //            sum(x.rating * y.rating) AS xyDotProduct,
  //            collect(x.rating) as xRatings, collect(y.rating) as yRatings
  //       WHERE numbermovies > 10
  //       WITH p1, p2, xyDotProduct,
  //       sqrt(reduce(xDot = 0.0, a IN xRatings | xDot + a^2)) AS xLength,
  //       sqrt(reduce(yDot = 0.0, b IN yRatings | yDot + b^2)) AS yLength
  //       CALL {
  //           WITH p1, p2
  //           MATCH (p2:User)-[p2r:RATED]->(m2:Movie)
  //           WHERE NOT EXISTS {(p1:User)-[:RATED]-(m2)}
  //           RETURN m2
  //           ORDER BY p2r.rating DESC
  //           LIMIT 1
  //       }
  //       RETURN {rec: m2.title, sim: xyDotProduct / (xLength * yLength)} AS data
  //       ORDER BY data.sim DESC
  //       LIMIT 10;
  //     `, { id: String(userId), limit: int(limit), skip: int(skip) })
  //   )
  //
  //   // Close the session
  //   await session.close()
  //   return res.records.map(row => toNativeTypes(row.get('data')))
  // }
  //
  // async pearsonSimilarityUsersContent(userId, order = 'DESC', limit = 6, skip = 0) {
  //   // Open a new database session
  //   const session = this.driver.session()
  //
  //   // Get recommendations based on weighted content
  //   const res = await session.readTransaction(
  //       tx => tx.run(`
  //       MATCH (u1:User {userId:$id})-[r:RATED]->(m:Movie)
  //       WITH u1, avg(r.rating) AS u1_mean
  //
  //       MATCH (u1)-[r1:RATED]->(m:Movie)<-[r2:RATED]-(u2)
  //       WITH u1, u1_mean, u2, collect({r1: r1, r2: r2}) AS ratings
  //       WHERE size(ratings) > 10
  //
  //       MATCH (u2)-[r:RATED]->(m:Movie)
  //       WITH u1, u1_mean, u2, avg(r.rating) AS u2_mean, ratings
  //
  //       UNWIND ratings AS r
  //
  //       WITH sum( (r.r1.rating-u1_mean) * (r.r2.rating-u2_mean) ) AS nom,
  //            sqrt( sum( (r.r1.rating - u1_mean)^2) * sum( (r.r2.rating - u2_mean) ^2)) AS denom,
  //            u1, u2 WHERE denom <> 0
  //       CALL {
  //           WITH u1, u2
  //           MATCH (u2:User)-[u2r:RATED]->(m2:Movie)
  //           WHERE NOT EXISTS {(u1:User)-[:RATED]-(m2)}
  //           RETURN m2
  //           ORDER BY u2r.rating DESC
  //           LIMIT 1
  //       }
  //       RETURN {rec: m2.title, sim: nom/denom} AS data
  //       ORDER BY data.sim DESC LIMIT 10;
  //     `, { id: String(userId), limit: int(limit), skip: int(skip) })
  //   )
  //
  //   // Close the session
  //   await session.close()
  //   return res.records.map(row => toNativeTypes(row.get('data')))
  // }


}
