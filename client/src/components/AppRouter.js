import React from 'react'
import {Switch, Route, Redirect} from 'react-router-dom'
import { authRoutes } from '../routes'

const AppRouter = () =>{
    const isAuth = false
    return(
    <Switch>
      {authRoutes.map(({path, Component})=>
        <Route key={path} path={path} component = {Component} exact/>
      )}
    </Switch>
  )
}

export default AppRouter;
