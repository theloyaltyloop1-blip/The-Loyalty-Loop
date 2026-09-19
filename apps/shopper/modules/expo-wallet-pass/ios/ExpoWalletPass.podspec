require 'json'

package = JSON.parse(File.read(File.join(__dir__, '..', 'package.json')))

Pod::Spec.new do |s|
  s.name           = 'ExpoWalletPass'
  s.version        = package['version']
  s.summary        = package['description']
  s.author         = 'The Loyalty Loop'
  s.homepage       = 'https://www.the-loyalty-loop.com'
  s.license        = 'MIT'
  s.platform       = :ios, '15.1'
  s.source         = { git: '' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'

  s.source_files = '*.swift'
end
